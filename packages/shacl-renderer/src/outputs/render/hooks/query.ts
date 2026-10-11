import type { Bindings, NamedNode, Term } from "@rdfjs/types";
import { queryPrefixes, sh } from "@/helpers/namespaces.ts";
import { localNameLabel } from "@/helpers/localNameLabel.ts";
import { descriptionText } from "@/helpers/descriptionText.ts";
import { escapeSparqlLiteral } from "@/helpers/sparqlLiteral.ts";
import { fetchWithCorsProxyFallback, getQueryEngine } from "@/helpers/queryEngine.ts";
import { geosparqlExtensionFunctions } from "@/helpers/geosparqlFunctions.ts";
import {
  classificationRolePropertyPaths,
  asIconIri,
  depictionRolePropertyPaths,
  descriptionRolePropertyPaths,
  effectiveLabelPredicates,
  iconRolePropertyPaths,
  labelRolePropertyPaths,
  valueNodeColor,
  valueNodeIcon,
} from "@/resolution/label.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

// Caps how many candidate values a single search-as-you-type or shui:searchQuery round trip
// returns.
const SEARCH_RESULT_LIMIT = 100;

// A label match beats an IRI match; an instance matching on both outscores either alone. An exact
// (whole-string) match on either always outranks any combination of partial/substring matches -
// LABEL_MATCH_WEIGHT + IRI_MATCH_WEIGHT can never exceed EXACT_MATCH_WEIGHT.
const LABEL_MATCH_WEIGHT = 2;
const IRI_MATCH_WEIGHT = 1;
const EXACT_MATCH_WEIGHT = 100;

// How long batchRoleLookup waits after its first call before running the merged query - long
// enough that a form mounting many properties at once (each hydrating its own sh:in options/
// current value via fetchOptions) piles its requests into the same window instead of firing one
// HTTP round trip per property, short enough to be imperceptible as added latency.
const ROLE_LOOKUP_BATCH_DELAY_MS = 100;

type ResolvedClassification = { term: Term; label: string; color?: string };

export type ResolvedTerm = {
  term: Term;
  label?: string;
  // Every distinct shui:ClassificationRole value (e.g. each skos:inScheme of a Concept in several
  // schemes), one chip each - see toResolvedTerms for how the query's one-row-per-classification
  // bindings are folded back into a single ResolvedTerm per value.
  classifications?: ResolvedClassification[];
  depiction?: NamedNode;
  icon?: NamedNode;
  description?: string;
};

// The narrower shape callers that only ever deal in IRIs (class-instance search, sh:in option
// lookups) work with, rather than ResolvedTerm's arbitrary Term - see toSearchResults.
export type SearchResult = {
  iri: NamedNode;
  label?: string;
  classifications?: ResolvedClassification[];
  depiction?: NamedNode;
  icon?: NamedNode;
  description?: string;
};

// dbpedia-style data tags literals with a bare language subtag ("en"), not a full BCP47 tag
// ("en-GB") - matching just the primary subtag is a reasonable approximation of proper language
// negotiation for a SPARQL-side FILTER, without needing full RFC 4647 lookup here too.
function primaryLanguageSubtag(uiLanguage: string): string {
  return uiLanguage.split("-")[0];
}

// The endpoint a federated sh:select/shui:searchQuery fetches ?value from - role-resolution needs
// to run against that same endpoint, since ?value is a remote IRI in that case and plain triple
// patterns only ever see the local dataGraph. Only the first SERVICE clause is considered; a query
// federating across several endpoints is out of scope.
export function extractServiceEndpoint(query: string): string | undefined {
  return query.match(/\bSERVICE\s*(?:SILENT\s+)?<([^>]+)>/i)?.[1];
}

// Every distinct endpoint a query's SERVICE clauses reach, in first-appearance order - unlike
// extractServiceEndpoint, this is purely informational (e.g. listing them to the user), so a
// query federating across several endpoints lists all of them.
export function extractServiceEndpoints(query: string): string[] {
  const matches = query.matchAll(/\bSERVICE\s*(?:SILENT\s+)?<([^>]+)>/gi);
  return [...new Set(Array.from(matches, (match) => match[1]))];
}

// Matches a SELECT clause's first projected variable, e.g. "?value1" in "SELECT DISTINCT ?value1
// WHERE" or "?value" in "SELECT ?value {" - mirrors toResolvedTerms's own convention (the first
// projected variable, so sh:select queries need not name it ?value), but as a text-level
// parse rather than a binding-level one, since here the point is to inject a same-named VALUES
// clause into the query text itself, before it's ever run.
export const FIRST_PROJECTED_VARIABLE: RegExp = /select\s+(?:distinct\s+|reduced\s+)?[?$](\w+)/i;

// Matches a query's first SERVICE block's opening brace, so a VALUES clause can be inserted right
// after it - mirrors extractServiceEndpoint (only the first SERVICE clause matters).
const SERVICE_OPEN_BRACE = /\bSERVICE\s*(?:SILENT\s+)?<[^>]+>\s*\{/i;

/**
 * Rewrites `query` (an sh:in [ sh:select ] body, or any other sh:select-shaped query) to pre-bind
 * its first projected `variable` to exactly `values`, via an injected VALUES clause - so running
 * the rewritten query returns only the subset of `values` the query's own pattern actually
 * accepts, without ever pulling its full, independently-sized baseline result set (e.g. every
 * dbo:Philosopher on DBpedia, to check whether just one already-known IRI is a member). Inserted
 * right inside the first SERVICE block's braces when there is one (so it's evaluated as part of
 * that single remote request, not bind-joined against it locally), otherwise right inside the
 * outermost `{` (covering both `WHERE {` and the `WHERE`-less `SELECT ?value { ... }` form).
 *
 * Text-level insertion, not a full SPARQL parse - consistent with extractServiceEndpoint/
 * substituteSearchParameters above, which take the same lightweight-regex approach over the query
 * shapes this renderer actually needs to support (PREFIX declarations plus a single SELECT/WHERE,
 * optionally with one SERVICE block).
 */
export function insertValuesClause(query: string, variable: string, values: NamedNode[]): string {
  const valuesClause = `VALUES ?${variable} { ${values
    .map((value) => `<${value.value}>`)
    .join(" ")} } `;

  const serviceMatch = query.match(SERVICE_OPEN_BRACE);
  if (serviceMatch?.index !== undefined) {
    const insertAt = serviceMatch.index + serviceMatch[0].length;
    return query.slice(0, insertAt) + valuesClause + query.slice(insertAt);
  }

  const braceIndex = query.indexOf("{");
  if (braceIndex === -1) return query;
  return query.slice(0, braceIndex + 1) + valuesClause + query.slice(braceIndex + 1);
}

const IRI_REF = /<[^<>"{}|^`\\\x00-\x20]*>/y;

// Index of every `{`/`}` in `query` that is actual SPARQL syntax - i.e. not inside a string
// literal, an IRI (e.g. a PREFIX's `<...#>`) or a `#` comment.

function structuralBraceIndexes(query: string): number[] {
  const indexes: number[] = [];
  let index = 0;
  while (index < query.length) {
    const char = query[index];
    IRI_REF.lastIndex = index;
    if (char === "#") {
      const newline = query.indexOf("\n", index);
      index = newline === -1 ? query.length : newline + 1;
    } else if (char === '"' || char === "'") {
      const quote = query.startsWith(char.repeat(3), index) ? char.repeat(3) : char;
      let end = index + quote.length;
      while (end < query.length && !query.startsWith(quote, end)) end += query[end] === "\\" ? 2 : 1;
      index = end + quote.length;
    } else if (char === "<" && IRI_REF.test(query)) {
      index = IRI_REF.lastIndex;
    } else {
      if (char === "{" || char === "}") indexes.push(index);
      index++;
    }
  }
  return indexes;
}

function matchingBraceIndex(braces: number[], query: string, openIndex: number): number {
  let depth = 0;
  for (const brace of braces) {
    if (brace < openIndex) continue;
    depth += query[brace] === "{" ? 1 : -1;
    if (depth === 0) return brace;
  }
  return -1;
}

const ONLY_WHITESPACE_OR_COMMENTS = /^(?:\s|#[^\n]*)*$/;

/**
 * When `query`'s whole WHERE body is a single `SERVICE <endpoint> { ... }` block (the usual shape
 * of a shape-authored federated sh:select/shui:searchQuery), returns that query with the SERVICE
 * wrapper removed, plus the endpoint - so runQuery can hand the whole thing to that endpoint as
 * Comunica's sole `sparql` source in one request. Left wrapped, Comunica 5 decomposes the SERVICE
 * body into per-pattern requests joined client-side - e.g. a FILTER NOT EXISTS re-requested once
 * per ?label binding, ~190 requests for a single country (see helpers/queryEngine.ts's
 * selectBindings). Anything else (local patterns next to the SERVICE, several SERVICE clauses,
 * SERVICE SILENT, whose "errors become no results" semantics a plain source wouldn't keep) is left
 * alone.
 */
export function unwrapSoleService(query: string): { query: string; endpoint: string } | undefined {
  const serviceMatch = query.match(/\bSERVICE\s*<([^>]+)>\s*\{/i);
  if (serviceMatch?.index === undefined) return undefined;

  const braces = structuralBraceIndexes(query);
  const serviceOpen = serviceMatch.index + serviceMatch[0].length - 1;
  const outerOpen = braces[0];
  if (outerOpen === undefined || !braces.includes(serviceOpen)) return undefined;
  if (!ONLY_WHITESPACE_OR_COMMENTS.test(query.slice(outerOpen + 1, serviceMatch.index))) {
    return undefined;
  }

  const serviceClose = matchingBraceIndex(braces, query, serviceOpen);
  const outerClose = matchingBraceIndex(braces, query, outerOpen);
  if (serviceClose === -1 || outerClose === -1) return undefined;
  if (!ONLY_WHITESPACE_OR_COMMENTS.test(query.slice(serviceClose + 1, outerClose))) {
    return undefined;
  }

  const body = query.slice(serviceOpen + 1, serviceClose);
  if (/\bSERVICE\b/i.test(body)) return undefined;

  return {
    query: query.slice(0, outerOpen + 1) + body + query.slice(outerClose),
    endpoint: serviceMatch[1],
  };
}

// `valueVariable` is the query's first projected variable (see runQuery), so sh:select queries need
// not name it ?value. It has to come from the query's own projection rather than from `binding`
// itself: a Bindings' iteration order follows the engine's join order, not the SELECT clause's -
// e.g. a nested ClassificationRole optional can put ?classification ahead of ?value.
//
// A value with several ClassificationRole values comes back as several bindings - one per
// ?classification (buildSearchQuery/buildRoleLookupQuery group on it rather than sampling it, and a
// shape-authored sh:select may do the same) - folded back here into one ResolvedTerm per value, in
// first-seen order (so buildSearchQuery's ranking survives). Every other role keeps the first
// binding that has it; a classification seen twice (e.g. once per label language) keeps its first
// label.
function toResolvedTerms(bindings: Bindings[], valueVariable: string): ResolvedTerm[] {
  const resolvedByValue = new Map<string, ResolvedTerm>();

  for (const binding of bindings) {
    const term = binding.get(valueVariable);
    if (!term) continue;

    const labelTerm = binding.get("label");
    const classificationTerm = binding.get("classification");
    const classificationLabelTerm = binding.get("classificationLabel");
    const depictionTerm = binding.get("depiction");
    const iconTerm = binding.get("icon");
    const descriptionTerm = binding.get("description");

    const key = `${term.termType}:${term.value}`;
    const resolved = resolvedByValue.get(key) ?? { term };
    resolvedByValue.set(key, resolved);

    resolved.label ??= labelTerm?.termType === "Literal" ? labelTerm.value : undefined;
    resolved.depiction ??= depictionTerm?.termType === "NamedNode" ? depictionTerm : undefined;
    resolved.icon ??= iconTerm && asIconIri(iconTerm);
    resolved.description ??=
      descriptionTerm?.termType === "Literal" ? descriptionText(descriptionTerm) : undefined;

    // classificationTerm is whatever the shape's ClassificationRole path ends on - a literal (e.g.
    // skos:definition) or a linked resource (e.g. skos:inScheme). Kept as `term` either way so a
    // chip can link out to it; `label` prefers that resource's own resolved label
    // (classificationLabelTerm - see buildRoleLookupQuery/buildSearchQuery's second, nested
    // lookup), then classificationTerm's own lexical form, then its local name.
    if (
      classificationTerm &&
      !resolved.classifications?.some((existing) => existing.term.equals(classificationTerm))
    ) {
      resolved.classifications = [
        ...(resolved.classifications ?? []),
        {
          term: classificationTerm,
          label:
            classificationLabelTerm?.termType === "Literal"
              ? classificationLabelTerm.value
              : classificationTerm.termType === "Literal"
                ? classificationTerm.value
                : (localNameLabel(classificationTerm) ?? classificationTerm.value),
        },
      ];
    }
  }

  return [...resolvedByValue.values()];
}

// Shared by searchInstances and fetchOptions, whose callers only ever deal in IRIs - a class-
// instance query always binds ?value to a NamedNode by construction, so this is a narrowing rather
// than a filter that could drop real results.
function toSearchResults(results: ResolvedTerm[]): SearchResult[] {
  return results.flatMap(({ term, ...rest }): SearchResult[] =>
    term.termType === "NamedNode" ? [{ iri: term, ...rest }] : [],
  );
}

// A ClassificationRole value's own swatch color (st:ColorRole, resolved off its own rdf:type - see
// resolution/label.ts's valueNodeColor), applied to each of a ResolvedTerm's `classifications`
// independently, wherever this module produces one. Deliberately a plain local-graph lookup
// (propertyShape.dataGraph/shapesGraph), not a SPARQL-projected column: unlike LabelRole/ClassificationRole/
// DepictionRole (resolved statically from propertyShape's own sh:node/sh:class, so their SPARQL
// path text can be built up front), which node shape's st:ColorRole applies depends on the
// classification value's own rdf:type - only known once the query has already run. A federated
// (SERVICE-backed) classification resolves to no color here, since its triples were never
// materialized into the local dataGraph - the same "gracefully absent" fallback an unset role
// already has.
function withClassificationColor(
  result: ResolvedTerm,
  propertyShape: PropertyUIElement,
): ResolvedTerm {
  if (!result.classifications) return result;
  return {
    ...result,
    classifications: result.classifications.map((classification) => {
      const color = valueNodeColor({ term: classification.term, propertyShape });
      return color ? { ...classification, color } : classification;
    }),
  };
}

// A result the query found no IconRole value for still gets one from the local graphs - the value's
// own local triples, else the IconRole property shape's sh:defaultValue (see label.ts's
// valueNodeIcon). Icons are usually one class-wide default, which lives in the shapes graph and so
// never comes back from a (possibly federated) query.
function withIconFallback(result: ResolvedTerm, propertyShape: PropertyUIElement): ResolvedTerm {
  if (result.icon) return result;
  const icon = valueNodeIcon({ term: result.term, propertyShape });
  return icon ? { ...result, icon } : result;
}

// `endpoint`, when given (facet mode's Environment.facetsEndpoint), runs the query against that
// SPARQL endpoint instead of the local dataGraph - e.g. a TextSearchFacet's shui:searchQuery body,
// which searches the same data the facets themselves are querying. Without one, a query that is
// just a single SERVICE block runs against that SERVICE's endpoint directly (see unwrapSoleService).
export async function runQuery(
  rawQuery: string,
  propertyShape: PropertyUIElement,
  corsProxyUrl?: string,
  explicitEndpoint?: string,
): Promise<ResolvedTerm[]> {
  const unwrapped = explicitEndpoint ? undefined : unwrapSoleService(rawQuery);
  const query = unwrapped?.query ?? rawQuery;
  const endpoint = explicitEndpoint ?? unwrapped?.endpoint;
  const engine = await getQueryEngine();
  const result = await engine.query(query, {
    sources: endpoint ? [{ type: "sparql", value: endpoint }] : [propertyShape.dataGraph],
    // Always registered for the local dataGraph, not just for a query that's known to use one - a
    // shape-authored sh:select/shui:searchQuery body is arbitrary text this module never inspects
    // up front, so there's no cheaper way to know a geof: function is needed before the engine
    // itself hits it. An endpoint evaluates geof: itself.
    ...(endpoint ? {} : { extensionFunctions: geosparqlExtensionFunctions }),
    ...(corsProxyUrl ? { fetch: fetchWithCorsProxyFallback(corsProxyUrl) } : {}),
  } as never);
  if (result.resultType !== "bindings") return [];

  const [valueVariable] = (await result.metadata()).variables;
  if (!valueVariable) return [];

  const bindings = await (await result.execute()).toArray();
  return toResolvedTerms(bindings, valueVariable.value).map((resolved) =>
    withIconFallback(withClassificationColor(resolved, propertyShape), propertyShape),
  );
}

/**
 * A SPARQL query for every instance of `classIri` whose IRI or LabelRole label contains `search`
 * (case-insensitive), ranked by a ?score - a label match scores higher than an IRI match, an
 * instance matching both outscores either alone, and a whole-string ("full text") match on either
 * always outranks any partial/substring match. Results are ordered by descending score, so
 * callers can rely on array order rather than re-sorting client-side. `labelPaths` are SPARQL
 * property path expressions (see toSparql.ts) from a candidate instance to its label literal(s) -
 * searchInstances always supplies at least a plain rdfs:label fallback here (see labelPathsFor),
 * but an empty array is still handled (label scoring simply drops out, leaving IRI-only matching)
 * since this function is a plain SPARQL-builder, not itself aware of that fallback.
 * `classificationPaths` and `depictionPaths` are walked the same way to bind
 * `?classification`/`?depiction` alongside each result. Ranking and SEARCH_RESULT_LIMIT happen in
 * a subquery that leaves classifications out, joined back on afterwards one row per
 * ?classification (folded per value client-side, see toResolvedTerms) - so a value with several
 * classifications neither gets one picked arbitrarily nor uses up more than one slot of the limit. Unlike sh:in's role resolution (see
 * buildRoleLookupQuery), these roles can't be split into a separate lookup afterwards - the label
 * match has to happen inside the ranking query itself, since it's what's being ranked on. When
 * `?classification` lands on a resource rather than a literal (e.g. skos:inScheme), a nested
 * optional resolves *that* resource's own `?classificationLabel` too - via `labelPaths` (the same
 * paths used for the candidate's own label) falling back to plain rdfs:label, mirroring
 * valueNodeClassifications' recursive valueNodeLabel call for the local (non-federated) case.
 */
export function buildSearchQuery(
  classIri: NamedNode,
  { labelPaths, classificationPaths, depictionPaths, iconPaths, descriptionPaths }: RolePaths,
  search: string,
): string {
  const needle = escapeSparqlLiteral(search.trim().toLowerCase());
  const labelPattern =
    labelPaths.length > 0 ? `optional { ?value ${labelPaths.join("|")} ?iriLabel }` : "";
  const labelScoreExpression =
    labelPaths.length > 0
      ? `if(bound(?iriLabel) && contains(lcase(str(?iriLabel)), "${needle}"), ${LABEL_MATCH_WEIGHT}, 0)`
      : "0";
  const exactScoreExpression = `if((${
    labelPaths.length > 0 ? `bound(?iriLabel) && lcase(str(?iriLabel)) = "${needle}"` : "false"
  }) || lcase(str(?value)) = "${needle}", ${EXACT_MATCH_WEIGHT}, 0)`;
  const classificationLabelPaths = [...new Set([...labelPaths, "rdfs:label"])];
  const classificationPattern =
    classificationPaths.length > 0
      ? `optional {
          ?value ${classificationPaths.join("|")} ?classification .
          optional { ?classification ${classificationLabelPaths.join("|")} ?classificationLabel }
        }`
      : "";
  const depictionPattern =
    depictionPaths.length > 0
      ? `optional { ?value ${depictionPaths.join("|")} ?iriDepiction }`
      : "";
  const iconPattern =
    iconPaths.length > 0 ? `optional { ?value ${iconPaths.join("|")} ?iriIcon }` : "";
  const descriptionPattern =
    descriptionPaths.length > 0
      ? `optional { ?value ${descriptionPaths.join("|")} ?iriDescription }`
      : "";

  return `
    ${queryPrefixes}
    select ?value ?label ?classification ?classificationLabel ?depiction ?icon ?description ?score where {
      {
        select ?value (sample(?iriLabel) as ?label) (sample(?iriDepiction) as ?depiction) (sample(?iriIcon) as ?icon) (sample(?iriDescription) as ?description) (max(?matchScore) as ?score) where {
          ?value a <${classIri.value}> .
          ${labelPattern}
          ${depictionPattern}
          ${iconPattern}
          ${descriptionPattern}
          bind(${labelScoreExpression} as ?labelScore)
          bind(if(contains(lcase(str(?value)), "${needle}"), ${IRI_MATCH_WEIGHT}, 0) as ?iriScore)
          bind(${exactScoreExpression} as ?exactScore)
          bind(?labelScore + ?iriScore + ?exactScore as ?matchScore)
          filter(?matchScore > 0)
        }
        group by ?value
        order by desc(?score)
        limit ${SEARCH_RESULT_LIMIT}
      }
      ${classificationPattern}
    }
    order by desc(?score)
  `;
}

/**
 * A SPARQL query resolving every one of `values` (e.g. a set of sh:in options, a property's
 * current value, or the results of a federated sh:select/shui:searchQuery) to its LabelRole label,
 * ClassificationRole info and DepictionRole image in one round trip, via a single `values` clause
 * instead of one query per value. `uiLanguage` is optional - when given, a label/classification
 * only counts if it matches that language (or has none), the way a federated lookup needs to
 * disambiguate a remote endpoint's multi-language literals; local-only lookups leave it out and
 * take whatever's there, the same as `?value`'s own rdfs:label would. A federated lookup is not
 * wrapped in `SERVICE <endpoint>` here - runRoleLookupQuery runs it with that endpoint as Comunica's
 * sole `sparql` source instead, since Comunica 5 decomposes a SERVICE block's contents into
 * per-pattern requests (each OPTIONAL fetched unbound - e.g. every dbo:thumbnail on DBpedia -
 * then joined client-side), whereas a lone `sparql` source ships the whole query in one request
 * (see helpers/queryEngine.ts's selectBindings).
 *
 * When `?roleClassification` lands on a resource rather than a literal (e.g. skos:inScheme, on a
 * skos:ConceptScheme), a nested optional resolves *that* resource's own `?classificationLabel` too
 * - via `labelPaths` (the same paths used for `?value`'s own label) falling back to plain
 * rdfs:label, mirroring valueNodeClassifications' recursive valueNodeLabel call for the local
 * (non-federated) case. Grouped per ?roleClassification as well as ?value, so a value with several
 * classifications comes back as one row per classification (folded per value client-side, see
 * toResolvedTerms) rather than having one sampled arbitrarily.
 */
function buildRoleLookupQuery(
  values: Term[],
  { labelPaths, classificationPaths, depictionPaths, iconPaths, descriptionPaths }: RolePaths,
  uiLanguage: string | undefined,
): string {
  const languageFilter = uiLanguage
    ? (variable: string) => {
        const language = primaryLanguageSubtag(uiLanguage);
        return ` . filter(lang(${variable}) = "${language}" || lang(${variable}) = "")`;
      }
    : () => "";

  const classificationLabelPaths = [...new Set([...labelPaths, "rdfs:label"])];

  const patterns = [
    labelPaths.length > 0 &&
      `optional { ?value ${labelPaths.join("|")} ?roleLabel${languageFilter("?roleLabel")} }`,
    classificationPaths.length > 0 &&
      `optional {
        ?value ${classificationPaths.join("|")} ?roleClassification .
        optional { ?roleClassification ${classificationLabelPaths.join(
          "|",
        )} ?roleClassificationLabel${languageFilter("?roleClassificationLabel")} }
      }`,
    depictionPaths.length > 0 && `optional { ?value ${depictionPaths.join("|")} ?roleDepiction }`,
    iconPaths.length > 0 && `optional { ?value ${iconPaths.join("|")} ?roleIcon }`,
    descriptionPaths.length > 0 &&
      `optional { ?value ${descriptionPaths.join("|")} ?roleDescription${languageFilter("?roleDescription")} }`,
  ]
    .filter((pattern): pattern is string => Boolean(pattern))
    .join("\n");

  const valuesClause = `values ?value { ${values.map((value) => `<${value.value}>`).join(" ")} }`;

  return `
    ${queryPrefixes}
    select ?value (sample(?roleLabel) as ?label) (sample(?roleClassification) as ?classification) (sample(?roleClassificationLabel) as ?classificationLabel) (sample(?roleDepiction) as ?depiction) (sample(?roleIcon) as ?icon) (sample(?roleDescription) as ?description) where {
      ${valuesClause} ${patterns}
    }
    group by ?value ?roleClassification
  `;
}

type RoleLookupOptions = { uiLanguage?: string; endpoint?: string; corsProxyUrl?: string };

// A value's LabelRole path(s), falling back to plain rdfs:label (or a configured
// shui:labelPreference) when its node shape has no explicit shui:LabelRole annotation - mirrors
// resolution/label.ts's valueNodeLabel() steps 3/4 spec fallback, so a class whose instances only
// carry an ordinary rdfs:label (no shui:LabelRole property shape) still resolves a label here
// instead of silently falling back to the raw IRI. Shared by rolePathsFor and searchInstances.
function labelPathsFor(propertyShape: PropertyUIElement) {
  const roles = labelRolePropertyPaths(propertyShape);
  return roles.length > 0
    ? roles
    : effectiveLabelPredicates(propertyShape.shapesGraph, "term");
}

// Every role's SPARQL path expressions for a shape - what buildSearchQuery/buildRoleLookupQuery walk
// from ?value to bind each role's column.
type RolePaths = {
  labelPaths: string[];
  classificationPaths: string[];
  depictionPaths: string[];
  iconPaths: string[];
  descriptionPaths: string[];
};

// Shared by searchInstances, resolveRoles and fetchOptions/batchRoleLookup so all of them compute
// the exact same set of SPARQL path expressions for a given shape.
function rolePathsFor(propertyShape: PropertyUIElement): RolePaths {
  return {
    labelPaths: labelPathsFor(propertyShape).map((path) => toSparql(path)),
    classificationPaths: classificationRolePropertyPaths(propertyShape).map((path) => toSparql(path)),
    depictionPaths: depictionRolePropertyPaths(propertyShape).map((path) => toSparql(path)),
    iconPaths: iconRolePropertyPaths(propertyShape).map((path) => toSparql(path)),
    descriptionPaths: descriptionRolePropertyPaths(propertyShape).map((path) => toSparql(path)),
  };
}

// The actual build-query/run-it/map-results-back-to-`values` step, shared by resolveRoles' direct
// (unbatched) path and batchRoleLookup's merged one - the only difference between the two is which
// `values` (and whose promise) this ends up resolving.
async function runRoleLookupQuery(
  values: Term[],
  propertyShape: PropertyUIElement,
  paths: RolePaths,
  options: RoleLookupOptions,
): Promise<ResolvedTerm[]> {
  const query = buildRoleLookupQuery(values, paths, options.uiLanguage);
  const resolved = await runQuery(query, propertyShape, options.corsProxyUrl, options.endpoint);
  const resolvedByValue = new Map(resolved.map((result) => [result.term.value, result]));

  return values.map((term) => ({ term, ...resolvedByValue.get(term.value) }));
}

/**
 * Resolves every one of `values`' LabelRole/ClassificationRole/DepictionRole via a single batched
 * query (see buildRoleLookupQuery) - runFederatedQuery's dedicated "hydrate a fixed, already-known
 * set of values" step for a federated sh:select/shui:searchQuery's results. Runs immediately,
 * unbatched across calls - unlike fetchOptions/batchRoleLookup below, there's no cross-property
 * mounting burst to coalesce here: this only ever runs after useInstanceSearch's own client-side
 * debounce, on an interactive per-keystroke path where responsiveness matters more than round-trip
 * count.
 */
async function resolveRoles(
  values: Term[],
  propertyShape: PropertyUIElement,
  options: RoleLookupOptions = {},
): Promise<ResolvedTerm[]> {
  if (values.length === 0) return [];

  return runRoleLookupQuery(values, propertyShape, rolePathsFor(propertyShape), options);
}

/**
 * Instances of this property's sh:class whose IRI or LabelRole label matches `search`, found via
 * Comunica against the already-loaded dataGraph - shacl-renderer preprocesses every configured
 * source into one local RdfStore up front (see preprocess/resolveRdfSources.ts), so there is no
 * separate remote endpoint to query here.
 */
export async function searchInstances(
  shape: PropertyUIElement,
  search: string,
  corsProxyUrl?: string,
): Promise<SearchResult[]> {
  const classIri = shape.get(sh("class"))[0] as NamedNode | undefined;
  if (!classIri) return [];

  const query = buildSearchQuery(classIri, rolePathsFor(shape), search);

  return toSearchResults(await runQuery(query, shape, corsProxyUrl));
}

type RoleLookupBatchEntry = {
  values: Map<string, Term>;
  waiters: Array<{
    values: Term[];
    resolve: (result: ResolvedTerm[]) => void;
    reject: (error: unknown) => void;
  }>;
};

// Keyed on propertyShape.dataGraph first (an RdfStore, one per Environment, rebuilt fresh on every
// mount - see EnvironmentContextProvider - so a WeakMap here can never coalesce two properties from
// different renders/environments), then on a string of everything else that determines the query
// text (role paths + language + endpoint + cors proxy) - two properties only share a batch when
// their buildRoleLookupQuery call would otherwise be identical modulo `values`.
const roleLookupBatches = new WeakMap<object, Map<string, RoleLookupBatchEntry>>();

function roleLookupBatchKey(paths: RolePaths, options: RoleLookupOptions): string {
  return JSON.stringify([
    paths.labelPaths,
    paths.classificationPaths,
    paths.depictionPaths,
    paths.iconPaths,
    paths.descriptionPaths,
    options.uiLanguage,
    options.endpoint,
    options.corsProxyUrl,
  ]);
}

// Runs once per batch, ROLE_LOOKUP_BATCH_DELAY_MS after the batch's first call: queries every
// value accumulated in the meantime and settles each waiter's own promise from the shared result -
// or, if the query itself throws, rejects every waiter with that same error (see batchRoleLookup).
async function runRoleLookupBatch(
  entry: RoleLookupBatchEntry,
  propertyShape: PropertyUIElement,
  paths: RolePaths,
  options: RoleLookupOptions,
): Promise<void> {
  try {
    const resolved = await runRoleLookupQuery(
      [...entry.values.values()],
      propertyShape,
      paths,
      options,
    );
    const resolvedByValue = new Map(resolved.map((result) => [result.term.value, result]));
    for (const waiter of entry.waiters) {
      waiter.resolve(waiter.values.map((term) => ({ term, ...resolvedByValue.get(term.value) })));
    }
  } catch (error) {
    for (const waiter of entry.waiters) waiter.reject(error);
  }
}

// Coalesces fetchOptions calls arriving within ROLE_LOOKUP_BATCH_DELAY_MS into one
// runRoleLookupQuery - mounting a form with many properties (each hydrating its own sh:in
// options/current value) would otherwise fire one HTTP round trip per property, even when several
// share the same sh:node role paths and endpoint. Every caller still gets back a ResolvedTerm[]
// matching exactly its own requested `values`, as if it had queried alone - callers can't tell the
// difference except in round-trip count. If the merged query throws, every waiter in the batch
// rejects together: everything sharing a batch key shares the same query, so a batch failing is a
// shape/endpoint-level failure, not a per-value one - a real (if narrow) increase in blast radius
// over calling runRoleLookupQuery directly, accepted for the round-trip savings.
function batchRoleLookup(
  values: Term[],
  propertyShape: PropertyUIElement,
  paths: RolePaths,
  options: RoleLookupOptions,
): Promise<ResolvedTerm[]> {
  let batchesForGraph = roleLookupBatches.get(propertyShape.dataGraph);
  if (!batchesForGraph) {
    batchesForGraph = new Map();
    roleLookupBatches.set(propertyShape.dataGraph, batchesForGraph);
  }

  const key = roleLookupBatchKey(paths, options);
  let entry = batchesForGraph.get(key);
  if (!entry) {
    entry = { values: new Map(), waiters: [] };
    const newEntry = entry;
    const graphBatches = batchesForGraph;
    batchesForGraph.set(key, newEntry);
    setTimeout(() => {
      graphBatches.delete(key);
      void runRoleLookupBatch(newEntry, propertyShape, paths, options);
    }, ROLE_LOOKUP_BATCH_DELAY_MS);
  }

  for (const term of values) entry.values.set(term.value, term);

  const pendingEntry = entry;
  return new Promise((resolve, reject) => {
    pendingEntry.waiters.push({ values, resolve, reject });
  });
}

/**
 * Resolves every one of `iris` (e.g. this property's currently applied value, or its sh:in options)
 * to its LabelRole label and DepictionRole image via a batched query (see batchRoleLookup), rather
 * than one per iri *or* one per property - callers within the same ROLE_LOOKUP_BATCH_DELAY_MS
 * window that would otherwise run an identical query share a single request. Lets AutoCompleteOption
 * stay a plain presentational component that never reads the data graph itself. `endpoint`, when the
 * shape's `sh:in` is itself federated (see extractServiceEndpoint), resolves against that remote
 * endpoint instead of the local dataGraph - without it, an IRI whose roles only exist on a remote
 * endpoint (e.g. a shui:searchQuery result applied on a previous visit) would resolve to nothing
 * every time it's re-hydrated on mount.
 */
export async function fetchOptions(
  shape: PropertyUIElement,
  iris: NamedNode[],
  options: RoleLookupOptions = {},
): Promise<SearchResult[]> {
  if (iris.length === 0) return [];

  return toSearchResults(await batchRoleLookup(iris, shape, rolePathsFor(shape), options));
}

/**
 * Runs a federated query (a `sh:in [ sh:select ]` body, or a `shui:searchQuery` body - the two are
 * asserted independently of each other, see searchQuery.ts) and resolves each
 * result's LabelRole/ClassificationRole/DepictionRole via `propertyShape`'s sh:node in a second request.
 * The first projected variable is used as the value IRI - it need not be named `?value`.
 *
 * Labels always come from propertyRoles (resolveRoles), never from the query itself - and always
 * include at least a plain rdfs:label attempt (see labelPathsFor) even when no shui:LabelRole is
 * declared, mirroring resolution/label.ts's valueNodeLabel() fallback. Results only come back
 * without a label when the remote value has neither an explicit role nor an rdfs:label of its own.
 *
 * Role resolution is a *second*, separate request that batches every value via a single `VALUES`
 * clause. That matters because Comunica's join planner evaluates a join between a small bindings
 * stream and a SERVICE clause as a bind join - materializing and re-running the SERVICE operation
 * once PER binding - so e.g. 100 results would mean ~100 extra HTTP requests. Two requests total
 * (independent of result count) is worth the extra round trip.
 */
export async function runFederatedQuery(
  rawQuery: string,
  propertyShape: PropertyUIElement,
  uiLanguage: string,
  corsProxyUrl?: string,
): Promise<ResolvedTerm[]> {
  const values = await runQuery(rawQuery, propertyShape, corsProxyUrl);
  if (values.length === 0) return [];

  return resolveRoles(
    values.map(({ term }) => term),
    propertyShape,
    { uiLanguage, endpoint: extractServiceEndpoint(rawQuery), corsProxyUrl },
  );
}

/**
 * Fills in shui:searchQuery's two reserved parameters - `$searchTerm` (what the user typed) and
 * `$uiLanguage` (their interface language) - as literal string values, and appends the LIMIT the
 * spec forbids the query itself from declaring. These aren't real SPARQL variables a query result
 * binds: the spec defines them as parameters the renderer substitutes at execution time (the same
 * idea as e.g. Jena's ParameterizedSparqlString), which is unavoidable here since they're typically
 * used inside a SERVICE block a plain VALUES/BIND join can't reach into. `?searchTerm`/
 * `?uiLanguage` are accepted too - SPARQL treats `?x` and `$x` as the same variable under two
 * valid surface syntaxes, and shape authors may write either.
 */
export function substituteSearchParameters(
  query: string,
  searchTerm: string,
  uiLanguage: string,
): string {
  const substituted = query
    .replace(/[?$]searchTerm\b/g, `"${escapeSparqlLiteral(searchTerm)}"`)
    .replace(/[?$]uiLanguage\b/g, `"${escapeSparqlLiteral(uiLanguage)}"`);

  return `${substituted}\nLIMIT ${SEARCH_RESULT_LIMIT}`;
}
