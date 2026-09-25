import type { Bindings } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { withCorsProxy } from "@/helpers/corsProxy.ts";
import { geosparqlExtensionFunctions } from "@/helpers/geosparqlFunctions.ts";

// The one Comunica engine every module in this package runs its SPARQL through - a local RDF/JS
// store, a remote SPARQL endpoint and a federated SERVICE clause are all just different sources/
// query text for the same engine. Lives in helpers/ (not outputs/render/) so structure-level
// modules like facets/ can share it without an import cycle. Dynamically imported and cached so
// nothing pays for Comunica until a query actually runs.
let enginePromise: Promise<import("@comunica/query-sparql").QueryEngine> | undefined;
export function getQueryEngine(): Promise<import("@comunica/query-sparql").QueryEngine> {
  enginePromise ??= import("@comunica/query-sparql").then(({ QueryEngine }) => new QueryEngine());
  return enginePromise;
}

// Passed as Comunica's `context.fetch` when a corsProxyUrl is configured, so every HTTP request
// Comunica makes for a query (a SPARQL endpoint source, a federated SERVICE endpoint) falls back to
// the proxy on a failed direct attempt - the same "try direct first" fallback resolveRdfSources.ts
// applies to shapesGraph/dataGraph/scoresGraph URLs.
export function fetchWithCorsProxyFallback(corsProxyUrl: string): typeof fetch {
  return async (input, init) => {
    const direct = await fetch(input, init).catch((error: Error) => error);
    if (direct instanceof Response && direct.ok) return direct;

    const url = input instanceof Request ? input.url : input.toString();
    return fetch(withCorsProxy(url, corsProxyUrl), init);
  };
}

/**
 * Where a query's triples come from: the already-loaded local store, or a remote SPARQL endpoint
 * (Environment.facetsEndpoint). With a single endpoint source Comunica ships the whole query text to
 * the endpoint in one request (aggregates, EXISTS and all) instead of decomposing it into triple
 * patterns - which is what makes facet queries viable against a huge endpoint at all.
 */
export type QuerySource =
  | { kind: "local"; store: RdfStore }
  | { kind: "endpoint"; url: string };

export type QueryOptions = {
  corsProxyUrl?: string;
  // Test/embedding hook: replaces the global fetch for every HTTP request Comunica makes.
  fetch?: typeof fetch;
};

// A query's prologue (PREFIX/BASE declarations) - has to stay at the top level when the rest of the
// query is nested inside a SERVICE block (see asServiceQuery).
const PROLOGUE = /^(\s*(?:PREFIX\s+[\w.-]*:\s*<[^>]*>|BASE\s*<[^>]*>)\s*)*/i;

/**
 * `query` nested whole inside `SERVICE <endpoint> { ... }`, prologue kept outside. Comunica's own
 * source planner decides per query whether to ship it to a plain `sparql` source intact or split
 * it into smaller requests it then joins/filters/aggregates client-side - and it splits as soon as
 * it sees a function it has a local implementation for (the geof: extension functions), which
 * against a large endpoint means downloading whole predicates' worth of triples. A SERVICE clause
 * is always sent to its endpoint as one query, so every facet query stays a single request whose
 * aggregation the endpoint does itself.
 */
export function asServiceQuery(query: string, endpoint: string): string {
  const prologue = query.match(PROLOGUE)?.[0] ?? "";
  return `${prologue}\nSELECT * WHERE { SERVICE <${endpoint}> { ${query.slice(prologue.length)} } }`;
}

// The empty store an endpoint query's SERVICE wrapper runs "against" - Comunica needs at least one
// source, but everything the query reads comes from inside the SERVICE block.
let emptyStore: RdfStore | undefined;

/**
 * Runs a SELECT `query` against `source`, returning every binding. The GeoSPARQL extension
 * functions (helpers/geosparqlFunctions.ts) are registered for a local source only - an endpoint
 * query is shipped whole (see asServiceQuery) and the endpoint evaluates geof: itself.
 */
export async function selectBindings(
  query: string,
  source: QuerySource,
  options: QueryOptions = {},
): Promise<Bindings[]> {
  const engine = await getQueryEngine();
  const fetchOverride =
    options.fetch ??
    (options.corsProxyUrl ? fetchWithCorsProxyFallback(options.corsProxyUrl) : undefined);
  emptyStore ??= (await import("rdf-stores")).RdfStore.createDefault();
  const stream = await engine.queryBindings(
    source.kind === "local" ? query : asServiceQuery(query, source.url),
    {
      sources: [source.kind === "local" ? source.store : emptyStore],
      ...(source.kind === "local" ? { extensionFunctions: geosparqlExtensionFunctions } : {}),
      ...(fetchOverride ? { fetch: fetchOverride } : {}),
    } as never,
  );
  return stream.toArray();
}
