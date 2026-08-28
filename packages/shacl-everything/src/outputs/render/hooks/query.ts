import type { Bindings, NamedNode, Term } from "@rdfjs/types";
import { queryPrefixes, sh } from "@/helpers/namespaces.ts";
import {
  depictionRolePropertyPaths,
  labelRolePropertyPaths,
  subLabelRolePropertyPaths,
} from "@/resolution/label.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

// Caps how many candidate values a single search-as-you-type or shui:searchQuery round trip
// returns.
const SEARCH_RESULT_LIMIT = 100;

// A label match beats an IRI match; an instance matching on both outscores either alone.
const LABEL_MATCH_WEIGHT = 2;
const IRI_MATCH_WEIGHT = 1;

export type ResolvedTerm = {
  term: Term;
  label?: string;
  subLabel?: string;
  depiction?: NamedNode;
};

// The narrower shape callers that only ever deal in IRIs (class-instance search, sh:in option
// lookups) work with, rather than ResolvedTerm's arbitrary Term - see toSearchResults.
export type SearchResult = {
  iri: NamedNode;
  label?: string;
  subLabel?: string;
  depiction?: NamedNode;
};

// One Comunica engine for every query this module runs, whether it only ever touches the already-
// loaded local dataGraph (a class-instance search, a batched sh:in lookup) or reaches out over a
// SERVICE clause (a federated sh:select/shui:searchQuery) - Comunica treats a local RDF/JS source
// and a remote SPARQL endpoint the same way, so there's no need for two separate engines/code
// paths for "local" vs "federated" queries, just different query text run against the same one.
// Dynamically imported and cached so nothing pays for Comunica's SPARQL-over-HTTP machinery until
// a query actually runs.
let enginePromise:
  | Promise<import("@comunica/query-sparql").QueryEngine>
  | undefined;
function getEngine() {
  enginePromise ??= import("@comunica/query-sparql").then(({ QueryEngine }) =>
    new QueryEngine()
  );
  return enginePromise;
}

function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(
    /\n/g,
    "\\n",
  );
}

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

function toResolvedTerms(bindings: Bindings[]): ResolvedTerm[] {
  return bindings.flatMap((binding): ResolvedTerm[] => {
    // Use the first projected variable, so sh:select queries need not name it ?value.
    const term = [...binding][0]?.[1];
    if (!term) return [];

    const labelTerm = binding.get("label");
    const subLabelTerm = binding.get("subLabel");
    const depictionTerm = binding.get("depiction");

    return [
      {
        term,
        label: labelTerm?.termType === "Literal" ? labelTerm.value : undefined,
        subLabel: subLabelTerm?.termType === "Literal"
          ? subLabelTerm.value
          : undefined,
        depiction: depictionTerm?.termType === "NamedNode"
          ? depictionTerm
          : undefined,
      },
    ];
  });
}

// Shared by searchInstances and fetchOptions, whose callers only ever deal in IRIs - a class-
// instance query always binds ?value to a NamedNode by construction, so this is a narrowing rather
// than a filter that could drop real results.
function toSearchResults(results: ResolvedTerm[]): SearchResult[] {
  return results.flatMap(({ term, ...rest }): SearchResult[] =>
    term.termType === "NamedNode" ? [{ iri: term, ...rest }] : []
  );
}

export async function runQuery(
  query: string,
  propertyShape: PropertyUIElement,
): Promise<ResolvedTerm[]> {
  const engine = await getEngine();
  const bindingsStream = await engine.queryBindings(query, {
    sources: [propertyShape.dataGraph],
  });
  return toResolvedTerms(await bindingsStream.toArray());
}

/**
 * A SPARQL query for every instance of `classIri` whose IRI or LabelRole label contains `search`
 * (case-insensitive), ranked by a ?score - a label match scores higher than an IRI match, and an
 * instance matching both outscores either alone. Results are ordered by descending score, so
 * callers can rely on array order rather than re-sorting client-side. `labelPaths` are SPARQL
 * property path expressions (see toSparql.ts) from a candidate instance to its label literal(s) -
 * left out of the scoring entirely when there are none, so a class with no shui:LabelRole still
 * searches by IRI alone. `subLabelPaths` and `depictionPaths` are walked the same way to bind
 * `?subLabel`/`?depiction` alongside each result. Unlike sh:in's role resolution (see
 * buildRoleLookupQuery), these roles can't be split into a separate lookup afterwards - the label
 * match has to happen inside the ranking query itself, since it's what's being ranked on.
 */
export function buildSearchQuery(
  classIri: NamedNode,
  labelPaths: string[],
  subLabelPaths: string[],
  depictionPaths: string[],
  search: string,
): string {
  const needle = escapeSparqlLiteral(search.trim().toLowerCase());
  const labelPattern = labelPaths.length > 0
    ? `optional { ?value ${labelPaths.join("|")} ?iriLabel }`
    : "";
  const labelScoreExpression = labelPaths.length > 0
    ? `if(bound(?iriLabel) && contains(lcase(str(?iriLabel)), "${needle}"), ${LABEL_MATCH_WEIGHT}, 0)`
    : "0";
  const subLabelPattern = subLabelPaths.length > 0
    ? `optional { ?value ${subLabelPaths.join("|")} ?iriSubLabel }`
    : "";
  const depictionPattern = depictionPaths.length > 0
    ? `optional { ?value ${depictionPaths.join("|")} ?iriDepiction }`
    : "";

  return `
    ${queryPrefixes}
    select ?value (sample(?iriLabel) as ?label) (sample(?iriSubLabel) as ?subLabel) (sample(?iriDepiction) as ?depiction) (max(?matchScore) as ?score) where {
      ?value a <${classIri.value}> .
      ${labelPattern}
      ${subLabelPattern}
      ${depictionPattern}
      bind(${labelScoreExpression} as ?labelScore)
      bind(if(contains(lcase(str(?value)), "${needle}"), ${IRI_MATCH_WEIGHT}, 0) as ?iriScore)
      bind(?labelScore + ?iriScore as ?matchScore)
      filter(?matchScore > 0)
    }
    group by ?value
    order by desc(?score)
    limit ${SEARCH_RESULT_LIMIT}
  `;
}

/**
 * A SPARQL query resolving every one of `values` (e.g. a set of sh:in options, a property's
 * current value, or the results of a federated sh:select/shui:searchQuery) to its LabelRole label,
 * SubLabelRole text and DepictionRole image in one round trip, via a single `values` clause instead
 * of one query per value. `uiLanguage` is optional - when given, a label/subLabel only counts if it
 * matches that language (or has none), the way a federated lookup needs to disambiguate a remote
 * endpoint's multi-language literals; local-only lookups leave it out and take whatever's there,
 * the same as `?value`'s own rdfs:label would. `endpoint`, when given, wraps the whole lookup in
 * `SERVICE <endpoint>` so it stays a single HTTP request to that endpoint instead of something
 * Comunica's join planner could split further - see resolveRoles for why that matters.
 */
function buildRoleLookupQuery(
  values: Term[],
  labelPaths: string[],
  subLabelPaths: string[],
  depictionPaths: string[],
  uiLanguage: string | undefined,
  endpoint: string | undefined,
): string {
  const languageFilter = uiLanguage
    ? (variable: string) => {
      const language = primaryLanguageSubtag(uiLanguage);
      return ` . filter(lang(${variable}) = "${language}" || lang(${variable}) = "")`;
    }
    : () => "";

  const patterns = [
    labelPaths.length > 0 &&
    `optional { ?value ${labelPaths.join("|")} ?roleLabel${
      languageFilter("?roleLabel")
    } }`,
    subLabelPaths.length > 0 &&
    `optional { ?value ${subLabelPaths.join("|")} ?roleSubLabel${
      languageFilter(
        "?roleSubLabel",
      )
    } }`,
    depictionPaths.length > 0 &&
    `optional { ?value ${depictionPaths.join("|")} ?roleDepiction }`,
  ]
    .filter((pattern): pattern is string => Boolean(pattern))
    .join("\n");

  const valuesClause = `values ?value { ${
    values.map((value) => `<${value.value}>`).join(" ")
  } }`;
  const where = endpoint
    ? `service <${endpoint}> { ${valuesClause} ${patterns} }`
    : `${valuesClause} ${patterns}`;

  return `
    ${queryPrefixes}
    select ?value (sample(?roleLabel) as ?label) (sample(?roleSubLabel) as ?subLabel) (sample(?roleDepiction) as ?depiction) where {
      ${where}
    }
    group by ?value
  `;
}

/**
 * Resolves every one of `values`' LabelRole/SubLabelRole/DepictionRole via a single batched query
 * (see buildRoleLookupQuery) - the shared "hydrate a fixed, already-known set of values" mechanism
 * behind fetchOptions (a local sh:in list or a property's current value) and runFederatedQuery's
 * second step (a federated sh:select/shui:searchQuery's results). Returns `values` unchanged (as
 * bare terms) without ever building or running a query when `propertyShape` declares none of those
 * roles, since the result would be identical either way.
 */
async function resolveRoles(
  values: Term[],
  propertyShape: PropertyUIElement,
  options: { uiLanguage?: string; endpoint?: string } = {},
): Promise<ResolvedTerm[]> {
  if (values.length === 0) return [];

  const labelPaths = labelRolePropertyPaths(propertyShape).map(toSparql);
  const subLabelPaths = subLabelRolePropertyPaths(propertyShape).map(toSparql);
  const depictionPaths = depictionRolePropertyPaths(propertyShape).map(
    toSparql,
  );

  if (labelPaths.length + subLabelPaths.length + depictionPaths.length === 0) {
    return values.map((term) => ({ term }));
  }

  const query = buildRoleLookupQuery(
    values,
    labelPaths,
    subLabelPaths,
    depictionPaths,
    options.uiLanguage,
    options.endpoint,
  );
  const resolved = await runQuery(query, propertyShape);
  const resolvedByValue = new Map(
    resolved.map((result) => [result.term.value, result]),
  );

  return values.map((term) => ({ term, ...resolvedByValue.get(term.value) }));
}

/**
 * Instances of this property's sh:class whose IRI or LabelRole label matches `search`, found via
 * Comunica against the already-loaded dataGraph - shacl-everything preprocesses every configured
 * source into one local RdfStore up front (see preprocess/resolveRdfSources.ts), so there is no
 * separate remote endpoint to query here.
 */
export async function searchInstances(
  shape: PropertyUIElement,
  search: string,
): Promise<SearchResult[]> {
  const classIri = shape.get(sh("class"))[0] as NamedNode | undefined;
  if (!classIri) return [];

  const labelPaths = labelRolePropertyPaths(shape).map(toSparql);
  const subLabelPaths = subLabelRolePropertyPaths(shape).map(toSparql);
  const depictionPaths = depictionRolePropertyPaths(shape).map(toSparql);
  const query = buildSearchQuery(
    classIri,
    labelPaths,
    subLabelPaths,
    depictionPaths,
    search,
  );

  return toSearchResults(await runQuery(query, shape));
}

/**
 * Resolves every one of `iris` (e.g. this property's currently applied value, or its sh:in options)
 * to its LabelRole label and DepictionRole image via resolveRoles, in a single batched query rather
 * than one per iri. Lets AutoCompleteOption stay a plain presentational component that never reads
 * the data graph itself. `endpoint`, when the shape's `sh:in` is itself federated (see
 * extractServiceEndpoint), resolves against that remote endpoint instead of the local dataGraph -
 * without it, an IRI whose roles only exist on a remote endpoint (e.g. a shui:searchQuery result
 * applied on a previous visit) would resolve to nothing every time it's re-hydrated on mount.
 */
export async function fetchOptions(
  shape: PropertyUIElement,
  iris: NamedNode[],
  options: { uiLanguage?: string; endpoint?: string } = {},
): Promise<SearchResult[]> {
  return toSearchResults(await resolveRoles(iris, shape, options));
}

/**
 * Runs a federated query (a `sh:in [ sh:select ]` body, or a `shui:searchQuery` body - the two are
 * asserted independently of each other, see searchQuery.ts) and resolves each
 * result's LabelRole/SubLabelRole/DepictionRole via `propertyShape`'s sh:node in a second request.
 * The first projected variable is used as the value IRI - it need not be named `?value`.
 *
 * Labels always come from propertyRoles (resolveRoles), never from the query itself. When no roles
 * are declared, results are returned without labels - the raw IRIs.
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
): Promise<ResolvedTerm[]> {
  const values = await runQuery(rawQuery, propertyShape);
  if (values.length === 0) return [];

  return resolveRoles(
    values.map(({ term }) => term),
    propertyShape,
    { uiLanguage, endpoint: extractServiceEndpoint(rawQuery) },
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
