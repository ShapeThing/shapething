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

/**
 * Runs a SELECT `query` against `source`, returning every binding. The GeoSPARQL extension
 * functions (helpers/geosparqlFunctions.ts) are registered for a local source only - an endpoint
 * query is shipped whole and the endpoint evaluates geof: itself.
 *
 * An endpoint is passed as an explicit `sparql` source rather than wrapped in a SERVICE clause:
 * Comunica 5 decomposes a SERVICE block's contents into per-pattern requests (one per VALUES row,
 * each joined client-side), whereas a lone `sparql` source gets the whole query in one request,
 * aggregates and geof: filters included.
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
  const stream = await engine.queryBindings(
    query,
    {
      sources: [source.kind === "local" ? source.store : { type: "sparql", value: source.url }],
      ...(source.kind === "local" ? { extensionFunctions: geosparqlExtensionFunctions } : {}),
      ...(fetchOverride ? { fetch: fetchOverride } : {}),
    } as never,
  );
  return stream.toArray();
}
