import type { Bindings, NamedNode, Term } from "@rdfjs/types";
import { queryPrefixes, sh } from "@/helpers/namespaces.ts";
import { localName } from "@/helpers/localName.ts";
import { withCorsProxy } from "@/helpers/corsProxy.ts";
import {
  classificationRolePropertyPaths,
  depictionRolePropertyPaths,
  labelRolePropertyPaths,
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

export type ResolvedTerm = {
  term: Term;
  label?: string;
  classification?: { term: Term; label: string };
  depiction?: NamedNode;
};

// The narrower shape callers that only ever deal in IRIs (class-instance search, sh:in option
// lookups) work with, rather than ResolvedTerm's arbitrary Term - see toSearchResults.
export type SearchResult = {
  iri: NamedNode;
  label?: string;
  classification?: { term: Term; label: string };
  depiction?: NamedNode;
};

// One Comunica engine for every query this module runs, whether it only ever touches the already-
// loaded local dataGraph (a class-instance search, a batched sh:in lookup) or reaches out over a
// SERVICE clause (a federated sh:select/shui:searchQuery) - Comunica treats a local RDF/JS source
// and a remote SPARQL endpoint the same way, so there's no need for two separate engines/code
// paths for "local" vs "federated" queries, just different query text run against the same one.
// Dynamically imported and cached so nothing pays for Comunica's SPARQL-over-HTTP machinery until
// a query actually runs.
let enginePromise: Promise<import("@comunica/query-sparql").QueryEngine> | undefined;
function getEngine() {
  enginePromise ??= import("@comunica/query-sparql").then(({ QueryEngine }) => new QueryEngine());
  return enginePromise;
}

// Passed as Comunica's `context.fetch` when a corsProxyUrl is configured, so every HTTP request
// Comunica makes for this query (e.g. a federated SERVICE endpoint) falls back to the proxy on a
// failed direct attempt, the same "try direct first" fallback resolveRdfSources.ts applies to
// shapesGraph/dataGraph/scoresGraph URLs. Left unset entirely when no corsProxyUrl is configured,
// so Comunica's own default fetch behavior is unaffected.
function fetchWithCorsProxyFallback(corsProxyUrl: string): typeof fetch {
  return async (input, init) => {
    const direct = await fetch(input, init).catch((error: Error) => error);
    if (direct instanceof Response && direct.ok) return direct;

    const url = input instanceof Request ? input.url : input.toString();
    return fetch(withCorsProxy(url, corsProxyUrl), init);
  };
}

function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
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

// Matches a SELECT clause's first projected variable, e.g. "?value1" in "SELECT DISTINCT ?value1
// WHERE" or "?value" in "SELECT ?value {" - mirrors toResolvedTerms's own convention ("Use the
// first projected variable, so sh:select queries need not name it ?value"), but as a text-level
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

function toResolvedTerms(bindings: Bindings[]): ResolvedTerm[] {
  return bindings.flatMap((binding): ResolvedTerm[] => {
    // Use the first projected variable, so sh:select queries need not name it ?value.
    const term = [...binding][0]?.[1];
    if (!term) return [];

    const labelTerm = binding.get("label");
    const classificationTerm = binding.get("classification");
    const classificationLabelTerm = binding.get("classificationLabel");
    const depictionTerm = binding.get("depiction");

    return [
      {
        term,
        label: labelTerm?.termType === "Literal" ? labelTerm.value : undefined,
        // classificationTerm is whatever the shape's ClassificationRole path ends on - a literal
        // (e.g. skos:definition) or a linked resource (e.g. skos:inScheme). Kept as `term` either
        // way so a chip can link out to it; `label` prefers that resource's own resolved label
        // (classificationLabelTerm - see buildRoleLookupQuery/buildSearchQuery's second, nested
        // lookup), then classificationTerm's own lexical form, then its local name.
        classification: classificationTerm
          ? {
              term: classificationTerm,
              label:
                classificationLabelTerm?.termType === "Literal"
                  ? classificationLabelTerm.value
                  : classificationTerm.termType === "Literal"
                    ? classificationTerm.value
                    : localName(classificationTerm) ?? classificationTerm.value,
            }
          : undefined,
        depiction: depictionTerm?.termType === "NamedNode" ? depictionTerm : undefined,
      },
    ];
  });
}

// Shared by searchInstances and fetchOptions, whose callers only ever deal in IRIs - a class-
// instance query always binds ?value to a NamedNode by construction, so this is a narrowing rather
// than a filter that could drop real results.
function toSearchResults(results: ResolvedTerm[]): SearchResult[] {
  return results.flatMap(({ term, ...rest }): SearchResult[] =>
    term.termType === "NamedNode" ? [{ iri: term, ...rest }] : [],
  );
}

export async function runQuery(
  query: string,
  propertyShape: PropertyUIElement,
  corsProxyUrl?: string,
): Promise<ResolvedTerm[]> {
  const engine = await getEngine();
  const bindingsStream = await engine.queryBindings(query, {
    sources: [propertyShape.dataGraph],
    ...(corsProxyUrl ? { fetch: fetchWithCorsProxyFallback(corsProxyUrl) } : {}),
  });
  return toResolvedTerms(await bindingsStream.toArray());
}

/**
 * A SPARQL query for every instance of `classIri` whose IRI or LabelRole label contains `search`
 * (case-insensitive), ranked by a ?score - a label match scores higher than an IRI match, an
 * instance matching both outscores either alone, and a whole-string ("full text") match on either
 * always outranks any partial/substring match. Results are ordered by descending score, so
 * callers can rely on array order rather than re-sorting client-side. `labelPaths` are SPARQL
 * property path expressions (see toSparql.ts) from a candidate instance to its label literal(s) -
 * left out of the scoring entirely when there are none, so a class with no shui:LabelRole still
 * searches by IRI alone. `classificationPaths` and `depictionPaths` are walked the same way to bind
 * `?classification`/`?depiction` alongside each result. Unlike sh:in's role resolution (see
 * buildRoleLookupQuery), these roles can't be split into a separate lookup afterwards - the label
 * match has to happen inside the ranking query itself, since it's what's being ranked on. When
 * `?iriClassification` lands on a resource rather than a literal (e.g. skos:inScheme), a nested
 * optional resolves *that* resource's own `?classificationLabel` too - via `labelPaths` (the same
 * paths used for the candidate's own label) falling back to plain rdfs:label, mirroring
 * valueNodeClassification's recursive valueNodeLabel call for the local (non-federated) case.
 */
export function buildSearchQuery(
  classIri: NamedNode,
  labelPaths: string[],
  classificationPaths: string[],
  depictionPaths: string[],
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
          ?value ${classificationPaths.join("|")} ?iriClassification .
          optional { ?iriClassification ${classificationLabelPaths.join("|")} ?iriClassificationLabel }
        }`
      : "";
  const depictionPattern =
    depictionPaths.length > 0
      ? `optional { ?value ${depictionPaths.join("|")} ?iriDepiction }`
      : "";

  return `
    ${queryPrefixes}
    select ?value (sample(?iriLabel) as ?label) (sample(?iriClassification) as ?classification) (sample(?iriClassificationLabel) as ?classificationLabel) (sample(?iriDepiction) as ?depiction) (max(?matchScore) as ?score) where {
      ?value a <${classIri.value}> .
      ${labelPattern}
      ${classificationPattern}
      ${depictionPattern}
      bind(${labelScoreExpression} as ?labelScore)
      bind(if(contains(lcase(str(?value)), "${needle}"), ${IRI_MATCH_WEIGHT}, 0) as ?iriScore)
      bind(${exactScoreExpression} as ?exactScore)
      bind(?labelScore + ?iriScore + ?exactScore as ?matchScore)
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
 * ClassificationRole info and DepictionRole image in one round trip, via a single `values` clause
 * instead of one query per value. `uiLanguage` is optional - when given, a label/classification
 * only counts if it matches that language (or has none), the way a federated lookup needs to
 * disambiguate a remote endpoint's multi-language literals; local-only lookups leave it out and
 * take whatever's there, the same as `?value`'s own rdfs:label would. `endpoint`, when given, wraps
 * the whole lookup in `SERVICE <endpoint>` so it stays a single HTTP request to that endpoint
 * instead of something Comunica's join planner could split further - see resolveRoles for why that
 * matters.
 *
 * When `?roleClassification` lands on a resource rather than a literal (e.g. skos:inScheme, on a
 * skos:ConceptScheme), a nested optional resolves *that* resource's own `?classificationLabel` too
 * - via `labelPaths` (the same paths used for `?value`'s own label) falling back to plain
 * rdfs:label, mirroring valueNodeClassification's recursive valueNodeLabel call for the local
 * (non-federated) case.
 */
function buildRoleLookupQuery(
  values: Term[],
  labelPaths: string[],
  classificationPaths: string[],
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
  ]
    .filter((pattern): pattern is string => Boolean(pattern))
    .join("\n");

  const valuesClause = `values ?value { ${values.map((value) => `<${value.value}>`).join(" ")} }`;
  const where = endpoint
    ? `service <${endpoint}> { ${valuesClause} ${patterns} }`
    : `${valuesClause} ${patterns}`;

  return `
    ${queryPrefixes}
    select ?value (sample(?roleLabel) as ?label) (sample(?roleClassification) as ?classification) (sample(?roleClassificationLabel) as ?classificationLabel) (sample(?roleDepiction) as ?depiction) where {
      ${where}
    }
    group by ?value
  `;
}

type RoleLookupOptions = { uiLanguage?: string; endpoint?: string; corsProxyUrl?: string };

// Shared by resolveRoles and fetchOptions/batchRoleLookup so both compute the exact same set of
// SPARQL path expressions for a given shape.
function rolePathsFor(propertyShape: PropertyUIElement) {
  return {
    labelPaths: labelRolePropertyPaths(propertyShape).map(toSparql),
    classificationPaths: classificationRolePropertyPaths(propertyShape).map(toSparql),
    depictionPaths: depictionRolePropertyPaths(propertyShape).map(toSparql),
  };
}

// The actual build-query/run-it/map-results-back-to-`values` step, shared by resolveRoles' direct
// (unbatched) path and batchRoleLookup's merged one - the only difference between the two is which
// `values` (and whose promise) this ends up resolving.
async function runRoleLookupQuery(
  values: Term[],
  propertyShape: PropertyUIElement,
  labelPaths: string[],
  classificationPaths: string[],
  depictionPaths: string[],
  options: RoleLookupOptions,
): Promise<ResolvedTerm[]> {
  const query = buildRoleLookupQuery(
    values,
    labelPaths,
    classificationPaths,
    depictionPaths,
    options.uiLanguage,
    options.endpoint,
  );
  const resolved = await runQuery(query, propertyShape, options.corsProxyUrl);
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
 * count. Returns `values` unchanged (as bare terms) without ever building or running a query when
 * `propertyShape` declares none of those roles, since the result would be identical either way.
 */
async function resolveRoles(
  values: Term[],
  propertyShape: PropertyUIElement,
  options: RoleLookupOptions = {},
): Promise<ResolvedTerm[]> {
  if (values.length === 0) return [];

  const { labelPaths, classificationPaths, depictionPaths } = rolePathsFor(propertyShape);

  if (labelPaths.length + classificationPaths.length + depictionPaths.length === 0) {
    return values.map((term) => ({ term }));
  }

  return runRoleLookupQuery(values, propertyShape, labelPaths, classificationPaths, depictionPaths, options);
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
  corsProxyUrl?: string,
): Promise<SearchResult[]> {
  const classIri = shape.get(sh("class"))[0] as NamedNode | undefined;
  if (!classIri) return [];

  const labelPaths = labelRolePropertyPaths(shape).map(toSparql);
  const classificationPaths = classificationRolePropertyPaths(shape).map(toSparql);
  const depictionPaths = depictionRolePropertyPaths(shape).map(toSparql);
  const query = buildSearchQuery(classIri, labelPaths, classificationPaths, depictionPaths, search);

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

function roleLookupBatchKey(
  labelPaths: string[],
  classificationPaths: string[],
  depictionPaths: string[],
  options: RoleLookupOptions,
): string {
  return JSON.stringify([
    labelPaths,
    classificationPaths,
    depictionPaths,
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
  labelPaths: string[],
  classificationPaths: string[],
  depictionPaths: string[],
  options: RoleLookupOptions,
): Promise<void> {
  try {
    const resolved = await runRoleLookupQuery(
      [...entry.values.values()],
      propertyShape,
      labelPaths,
      classificationPaths,
      depictionPaths,
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
  labelPaths: string[],
  classificationPaths: string[],
  depictionPaths: string[],
  options: RoleLookupOptions,
): Promise<ResolvedTerm[]> {
  let batchesForGraph = roleLookupBatches.get(propertyShape.dataGraph);
  if (!batchesForGraph) {
    batchesForGraph = new Map();
    roleLookupBatches.set(propertyShape.dataGraph, batchesForGraph);
  }

  const key = roleLookupBatchKey(labelPaths, classificationPaths, depictionPaths, options);
  let entry = batchesForGraph.get(key);
  if (!entry) {
    entry = { values: new Map(), waiters: [] };
    const newEntry = entry;
    const graphBatches = batchesForGraph;
    batchesForGraph.set(key, newEntry);
    setTimeout(() => {
      graphBatches.delete(key);
      void runRoleLookupBatch(
        newEntry,
        propertyShape,
        labelPaths,
        classificationPaths,
        depictionPaths,
        options,
      );
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

  const { labelPaths, classificationPaths, depictionPaths } = rolePathsFor(shape);

  if (labelPaths.length + classificationPaths.length + depictionPaths.length === 0) {
    return toSearchResults(iris.map((term) => ({ term })));
  }

  return toSearchResults(
    await batchRoleLookup(iris, shape, labelPaths, classificationPaths, depictionPaths, options),
  );
}

/**
 * Runs a federated query (a `sh:in [ sh:select ]` body, or a `shui:searchQuery` body - the two are
 * asserted independently of each other, see searchQuery.ts) and resolves each
 * result's LabelRole/ClassificationRole/DepictionRole via `propertyShape`'s sh:node in a second request.
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
