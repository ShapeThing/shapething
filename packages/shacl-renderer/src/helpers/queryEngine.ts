import type { BlankNode, Bindings, Source, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { withCorsProxy } from "@/helpers/corsProxy.ts";
import { factory } from "@/helpers/factory.ts";

// The one Comunica engine every module in this package runs its SPARQL through - a local RDF/JS
// store, a remote SPARQL endpoint and a federated SERVICE clause are all just different sources/
// query text for the same engine. Lives in helpers/ (not outputs/render/) so structure-level
// modules like facets/ can share it without an import cycle. Dynamically imported and cached so
// nothing pays for Comunica until a query actually runs.
let enginePromise: Promise<import("@comunica/query-sparql").QueryEngine> | undefined;
export function getQueryEngine(): Promise<import("@comunica/query-sparql").QueryEngine> {
  // Comunica's streams (readable-stream) expect Node's `process` and `Buffer` globals - installed
  // first, and only now, rather than by every page that renders a form without ever querying.
  enginePromise ??= Promise.all([
    import("@/polyfills/ensureProcess.ts"),
    import("@/polyfills/ensureBuffer.ts"),
  ])
    .then(() => import("@comunica/query-sparql"))
    .then(({ QueryEngine }) => new QueryEngine());
  return enginePromise;
}

// The GeoSPARQL extension functions (and @turf/turf behind them) are only ever needed together
// with the engine, so they're loaded on demand alongside it rather than with the first render.
let extensionFunctionsPromise:
  | Promise<typeof import("@/helpers/geosparqlFunctions.ts").geosparqlExtensionFunctions>
  | undefined;
export function getGeosparqlExtensionFunctions() {
  extensionFunctionsPromise ??= import("@/helpers/geosparqlFunctions.ts").then(
    (module) => module.geosparqlExtensionFunctions,
  );
  return extensionFunctionsPromise;
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
/**
 * `fetchFn` with `signal` attached to every request - Comunica's own HTTP requests for one query
 * (an endpoint source, a SERVICE clause) are then cancelled the moment the query is superseded,
 * e.g. by the next keystroke of a search-as-you-type field.
 */
export function fetchWithSignal(fetchFn: typeof fetch, signal: AbortSignal): typeof fetch {
  return (input, init) =>
    fetchFn(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal,
    });
}

export type QuerySource = { kind: "local"; store: RdfStore } | { kind: "endpoint"; url: string };

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
  const stream = await engine.queryBindings(query, {
    sources: [source.kind === "local" ? source.store : { type: "sparql", value: source.url }],
    ...(source.kind === "local"
      ? { extensionFunctions: await getGeosparqlExtensionFunctions() }
      : {}),
    ...(fetchOverride ? { fetch: fetchOverride } : {}),
  } as never);
  return stream.toArray();
}

// The row type of a query string branded with one (e.g. a typed-sparql TypedQuery<Row>), else
// a plain record of terms.
type Brand<Query> = Exclude<keyof Query, keyof string>;
export type QueryRow<Query> = [Brand<Query>] extends [never]
  ? Record<string, Term>
  : Query[Brand<Query>] extends infer Row extends object
    ? Row
    : never;

/**
 * Runs a SELECT `query` against a local store and returns its rows as plain objects, variable
 * name to term. The store is any RDF/JS source: an RdfStore, or one that wraps another store, such
 * as a TextStore (@shapething/textstore) or a LocalStore (@shapething/localstore). `bindings`
 * pre-binds variables (blank nodes from `store` included). Patterns outside GRAPH {} see the union
 * of all graphs. Blank nodes in the rows are the store's own.
 */
export async function select<Query extends string>(
  query: Query,
  store: Source,
  bindings: Record<string, Term> = {},
): Promise<QueryRow<Query>[]> {
  const engine = await getQueryEngine();
  const { BindingsFactory } = await import("@comunica/utils-bindings-factory");
  const initialBindings = new BindingsFactory(factory).fromRecord(
    Object.fromEntries(Object.entries(bindings).map(([name, term]) => [name, toQueryTerm(term)])),
  );
  const stream = await engine.queryBindings(query, {
    sources: [store],
    unionDefaultGraph: true,
    initialBindings,
    extensionFunctions: await getGeosparqlExtensionFunctions(),
  } as never);
  const rows = await stream.toArray();
  return rows.map(
    (row) =>
      Object.fromEntries(
        [...row].map(([variable, term]) => [variable.value, toStoreTerm(term)]),
      ) as QueryRow<Query>,
  );
}

// Comunica scopes the blank nodes of a source: it hands them out labelled "bc_0_<label>", with
// the store's own label on a skolem IRI. A raw store blank node as a binding would match nothing,
// so it is given in that form; result blank nodes are turned back into the store's.
const SKOLEM_PREFIX = /^urn:comunica_skolem:source_\d+:/;

function toQueryTerm(term: Term): Term {
  if (term.termType !== "BlankNode") return term;
  const value = `bc_0_${term.value}`;
  return {
    termType: "BlankNode",
    value,
    skolemized: factory.namedNode(`urn:comunica_skolem:source_0:${term.value}`),
    equals: (other?: Term | null) => other?.termType === "BlankNode" && other.value === value,
  } as BlankNode;
}

function toStoreTerm(term: Term): Term {
  const skolemized = (term as { skolemized?: Term }).skolemized;
  if (term.termType !== "BlankNode" || skolemized?.termType !== "NamedNode") return term;
  return factory.blankNode(skolemized.value.replace(SKOLEM_PREFIX, ""));
}
