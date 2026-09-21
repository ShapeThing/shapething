import "@/polyfills/ensureProcess.ts";
import "@/polyfills/ensureBuffer.ts";
import type { Quad, Quad_Subject, Stream } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { rdfParser, type ParseOptions } from "rdf-parse";
import stringToStream from "string-to-stream";
import type { Environment, RawEnvironment } from "@/environment.ts";
import type { RdfSource } from "@/types/RdfSource.ts";
import { owl, rdf, sh } from "@/helpers/namespaces.ts";
import { withCorsProxy } from "@/helpers/corsProxy.ts";
import { isKnownNotFound, rememberNotFound } from "@/helpers/notFoundCache.ts";

// Populates Environment.sourcePrefixes by scanning a source's own raw text for `@prefix alias:
// <iri> .` (Turtle/TriG) and SPARQL-style `PREFIX alias: <iri>` declarations - a parsed RdfStore
// keeps only quads, so the source text itself is the only place this is ever observable at all.
// Deliberately NOT sourced from rdf-parse's own 'prefix' stream event: that event is forwarded
// onto its returned stream only once Comunica's actor-bus mediation resolves (see RdfParser.js's
// `mediatorRdfParseHandle.mediate(...).then(...)`), but the underlying N3 StreamParser it wraps
// already starts flowing (and firing 'prefix') the moment `actor.data.pipe(...)` runs inside that
// same mediation - a genuine race in rdf-parse itself, not something a listener placement on our
// end can fix. It reliably loses in this package's actual Vite/browser bundle (readable-stream's
// browser build schedules differently than Node's native streams), silently dropping every
// prefix - confirmed by instrumenting rdf-parse's own forwarding call directly. Scanning the text
// synchronously, before any streaming parse begins, sidesteps the race entirely. A format with no
// prefix concept (N-Triples, JSON-LD, ...) simply matches nothing, which is fine - `sink` just
// stays unfilled for that source.
const AT_PREFIX_PATTERN = /@prefix\s+([A-Za-z][\w.-]*)?:\s*<([^>\s]*)>\s*\./g;
const SPARQL_PREFIX_PATTERN = /(?:^|\s)PREFIX\s+([A-Za-z][\w.-]*)?:\s*<([^>\s]*)>/gi;

const extractSourcePrefixes = (text: string, sink: Map<string, string> | undefined): void => {
  if (!sink) return;
  for (const match of text.matchAll(AT_PREFIX_PATTERN)) sink.set(match[1] ?? "", match[2]);
  for (const match of text.matchAll(SPARQL_PREFIX_PATTERN)) sink.set(match[1] ?? "", match[2]);
};

const storeFromStream = (stream: Stream<Quad>): Promise<RdfStore> => {
  const store = RdfStore.createDefault();
  return new Promise((resolve, reject) => {
    store
      .import(stream)
      .on("end", () => resolve(store))
      .on("error", reject);
  });
};

const storeFromQuads = (quads: Iterable<Quad>): RdfStore => {
  const store = RdfStore.createDefault();
  for (const quad of quads) store.addQuad(quad);
  return store;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Dereferencing over HTTP is inherently flaky (dev servers cold-starting a route, proxies,
// transient network blips), so a fetch failure - including a 404 - is retried a couple of times
// with a short backoff before being treated as a real, permanent failure.
const RETRY_DELAYS_MS = [100, 300, 800, 1500];

type FetchedText = { text: string; contentType: string | undefined };

const toFetchedText = async (response: Response): Promise<FetchedText> => ({
  text: await response.text(),
  contentType: response.headers.get("content-type") ?? undefined,
});

// A cross-origin host with no permissive CORS headers will never succeed as a direct
// browser-origin request no matter how many times it's retried - the browser blocks it as an
// opaque failure with no readable status at all, so it can't even be told apart from a transient
// network blip. `location` is unavailable outside a browser (SSR, Node test runs), in which case
// origin can't be compared at all - treated as same-origin so the (only sensible there) direct
// path is used.
const isCrossOrigin = (url: URL): boolean => {
  try {
    return url.origin !== location.origin;
  } catch {
    return false;
  }
};

const fetchText = async (
  url: URL,
  corsProxyUrl: string | undefined,
): Promise<FetchedText> => {
  // A URL already known (from a previous page load) to 404 is skipped outright, rather than
  // paying the full retry+proxy-fallback cost again for a resource that's already confirmed gone.
  if (isKnownNotFound(url.href)) {
    throw new Error(`Failed to dereference ${url.href}: previously returned 404, not retrying`);
  }

  // A known-cross-origin URL goes straight through the proxy (once configured), rather than
  // wasting several retries plus their backoff delay on a direct attempt that's doomed to repeat
  // the exact same outcome every time - it also means the browser only ever logs one "blocked by
  // CORS" console entry (from the very first, unproxied real-world attempt at this URL) instead
  // of one per retry. A same-origin URL keeps trying directly first, since that's the cheaper,
  // proxy-independent path and it can plausibly recover from a transient failure.
  const proxyOnly = corsProxyUrl !== undefined && isCrossOrigin(url);
  const fetchUrl = proxyOnly ? withCorsProxy(url.href, corsProxyUrl) : url;

  for (let attempt = 0;; attempt++) {
    const response = await fetch(fetchUrl).catch((error: Error) => error);
    if (response instanceof Response && response.ok) return toFetchedText(response);

    if (attempt >= RETRY_DELAYS_MS.length) {
      // Direct retries are exhausted - fall back to the configured CORS proxy once, rather than
      // failing outright, before giving up and reporting the original direct-fetch failure.
      // (Already routed through the proxy from the start above when proxyOnly, so there's no
      // separate fallback attempt left to make here.)
      if (corsProxyUrl && !proxyOnly) {
        const proxied = await fetch(withCorsProxy(url.href, corsProxyUrl))
          .catch(
            (error: Error) => error,
          );
        if (proxied instanceof Response) {
          if (proxied.ok) return toFetchedText(proxied);
          // The proxied response is a same-origin, fully readable status - a stronger signal
          // than the direct attempt's opaque CORS failure below (which carries no status at
          // all) - so a definitive 404 here is remembered even when the direct attempt wasn't a
          // real Response to begin with.
          if (proxied.status === 404) rememberNotFound(url.href);
          throw new Error(
            `Failed to dereference ${url.href}: ${proxied.status} ${proxied.statusText}`,
          );
        }
      }

      if (response instanceof Response) {
        // Only a genuine, persistent 404 is remembered - a network error/other status might well
        // be transient, and caching that as permanent would wrongly hide the resource forever.
        if (response.status === 404) rememberNotFound(url.href);
        throw new Error(
          `Failed to dereference ${url.href}: ${response.status} ${response.statusText}`,
        );
      }
      throw response;
    }
    await wait(RETRY_DELAYS_MS[attempt]);
  }
};

// shapesGraph, dataGraph and scoresGraph are frequently dereferenced from the very same URL (e.g.
// test fixtures that combine shapes and instance data in one file). Fetching it once per source
// would fire that many concurrent, independent HTTP requests for one resource, which is wasteful.
// Keyed by hashless href, single-flight per call to resolveRdfSources() rather than cached
// module-wide, so a later preprocessing pass still refetches (in case the underlying resource
// changed) and mutation isolation between the returned stores is preserved - only the network
// round trip and parse are shared, each caller still gets its own RdfStore instance built from a
// fresh copy of the parsed quads.
// A URL fetched once (quadCache hit) for, say, shapesGraph must still contribute its own
// `@prefix` declarations to a second caller resolving the very same URL for dataGraph - even
// though the text is only ever fetched (and scanned for prefixes) once. Passing the very same
// `prefixSink` Map in for both callers (see resolveRdfSources below) sidesteps that entirely:
// whichever caller's fetch actually runs writes into the one shared destination, and that scan
// happens synchronously right after the text arrives, strictly before the cached promise
// resolves - so it's always fully populated by the time any awaiter of it proceeds.
export const dereferenceUrl = async (
  url: URL,
  quadCache: Map<string, Promise<Quad[]>>,
  corsProxyUrl: string | undefined,
  prefixSink?: Map<string, string>,
): Promise<RdfStore> => {
  const hashlessUrl = new URL(url.href.split("#")[0]);

  let quadsPromise = quadCache.get(hashlessUrl.href);
  if (!quadsPromise) {
    quadsPromise = (async () => {
      const { text, contentType } = await fetchText(hashlessUrl, corsProxyUrl);
      extractSourcePrefixes(text, prefixSink);
      // Content-negotiated ontology namespace IRIs (skos:, dct:, foaf:, ...) have no file
      // extension for rdf-parse to detect a format from, so the server's own declared
      // Content-Type is used instead in that case - the corsProxy explicitly requests one via an
      // RDF-shaped Accept header. A URL with a real extension (.ttl, .jsonld, ...) keeps using
      // that, since it's a more reliable signal than whatever a plain static file server happens
      // to default its Content-Type header to.
      const parseOptions: ParseOptions =
        rdfParser.getContentTypeFromExtension(hashlessUrl.href) || !contentType
          ? { path: hashlessUrl.href, baseIRI: url.href }
          : { contentType: contentType.split(";")[0].trim(), baseIRI: url.href };
      const store = await storeFromStream(rdfParser.parse(stringToStream(text), parseOptions));
      return store.getQuads();
    })();
    quadCache.set(hashlessUrl.href, quadsPromise);
  }

  return storeFromQuads(await quadsPromise);
};

const parseRdfText = (text: string, prefixSink?: Map<string, string>): Promise<RdfStore> => {
  extractSourcePrefixes(text, prefixSink);
  return storeFromStream(rdfParser.parse(stringToStream(text), { contentType: "text/turtle" }));
};

// owl:imports is resolved transitively: importing graph B into A can itself declare further
// imports, so the store is rescanned after every merge until a pass turns up nothing new.
// visitedImports is scoped to a single resolveRdfSource() call (one store) so that an import
// cycle (A imports B, B imports A) terminates instead of looping forever. It must NOT be shared
// across shapesGraph/dataGraph/scoresGraph: each of those needs the same import actually merged
// into its own store, and quadCache (shared across all of them) already dedups the fetch itself -
// sharing visitedImports too would make whichever store claims an href first "consume" it, leaving
// the others without the merge.
const resolveOwlImports = async (
  store: RdfStore,
  quadCache: Map<string, Promise<Quad[]>>,
  visitedImports: Set<string>,
  corsProxyUrl: string | undefined,
  prefixSink?: Map<string, string>,
): Promise<void> => {
  const importUrls = new Set<string>();
  for (const quad of store.getQuads(null, owl("imports"), null, null)) {
    if (
      quad.object.termType === "NamedNode" &&
      !visitedImports.has(quad.object.value)
    ) {
      importUrls.add(quad.object.value);
    }
  }
  if (!importUrls.size) return;

  for (const href of importUrls) visitedImports.add(href);

  // owl:imports targets are frequently third-party ontology URLs outside this app's control, and
  // dead/unreachable ones are common in practice (moved docs, expired domains, etc). A single dead
  // import must not fail the whole environment - it's supplementary vocabulary, not the actual
  // shapes/data being rendered - so each import is resolved independently and a failure is only
  // logged, not thrown.
  const hrefs = [...importUrls];
  const importedStores = await Promise.allSettled(
    hrefs.map((href) => dereferenceUrl(new URL(href), quadCache, corsProxyUrl, prefixSink)),
  );
  for (const [index, result] of importedStores.entries()) {
    if (result.status === "rejected") {
      console.warn(
        `[shacl-everything] Failed to resolve owl:imports <${hrefs[index]}>:`,
        result.reason,
      );
      continue;
    }
    for (const quad of result.value.getQuads()) store.addQuad(quad);
  }

  await resolveOwlImports(store, quadCache, visitedImports, corsProxyUrl, prefixSink);
};

// Bootstraps shapesGraph from the DATA graph's own sh:shape declarations (3.1.3.7 Explicit shape
// targets, see resolution/targets.ts) when the caller supplied no shapes graph at all. This lets a
// standalone resource - fetched with nothing but its data - name where its own shape lives (`<node>
// sh:shape <shapeIri>`) instead of requiring the embedder to already know and pass it in. Every
// distinct sh:shape object IRI is dereferenced the same way an owl:imports target is (same
// quadCache, so a shape also reachable via an actual owl:imports isn't fetched twice), merged into
// a fresh store, and resolveOwlImports is run on that afterwards so an owl:imports the fetched shape
// document itself declares is still picked up.
//
// Only fires when shapesGraph.size === 0: a shapesGraph the caller did supply - even a small,
// deliberately partial one - is left exactly as given, since sh:shape is meant to bootstrap the "no
// shapes at all" case, not overlay onto an intentionally scoped one. Returns a brand new RdfStore
// rather than mutating the given (empty) one in place: unlike a URL-sourced store, an
// already-materialized RdfStore passed in as `raw.shapesGraph` is returned as the very same instance
// by resolveRdfSource, and it's frequently a caller-held constant (e.g. defaultEnvironment's own
// module-level RdfStore.createDefault()) reused - unmutated - across many independent
// resolveRdfSources() calls; mutating it here would leak dereferenced shapes from one call's data
// graph into every other call that also defaults shapesGraph.
const dereferenceShapeTargets = async (
  dataGraph: RdfStore,
  quadCache: Map<string, Promise<Quad[]>>,
  corsProxyUrl: string | undefined,
  prefixSink?: Map<string, string>,
): Promise<RdfStore | undefined> => {
  const shapeIris = new Set<string>();
  for (const quad of dataGraph.getQuads(null, sh("shape"))) {
    if (quad.object.termType === "NamedNode") shapeIris.add(quad.object.value);
  }
  if (!shapeIris.size) return undefined;

  const hrefs = [...shapeIris];
  const dereferenced = await Promise.allSettled(
    hrefs.map((href) => dereferenceUrl(new URL(href), quadCache, corsProxyUrl, prefixSink)),
  );

  const merged = RdfStore.createDefault();
  for (const [index, result] of dereferenced.entries()) {
    if (result.status === "rejected") {
      console.warn(
        `[shacl-everything] Failed to dereference sh:shape <${hrefs[index]}>:`,
        result.reason,
      );
      continue;
    }
    for (const quad of result.value.getQuads()) merged.addQuad(quad);
  }
  if (merged.size === 0) return undefined;

  await resolveOwlImports(merged, quadCache, new Set<string>(), corsProxyUrl, prefixSink);
  return merged;
};

// A literal Quad[] and a list of RdfSources to merge are both plain arrays, so they're
// disambiguated by shape: an empty array is treated as (empty) quads, and a non-empty one is
// treated as quads only if its first element actually looks like a Quad.
const isQuad = (value: unknown): value is Quad =>
  value !== null &&
  typeof value === "object" &&
  "subject" in value &&
  "predicate" in value &&
  "object" in value &&
  "graph" in value;

const isRdfSourceList = (source: RdfSource): source is readonly RdfSource[] =>
  Array.isArray(source) && source.length > 0 && !isQuad(source[0]);

export const resolveRdfSource = async (
  source: RdfSource,
  quadCache: Map<string, Promise<Quad[]>>,
  corsProxyUrl: string | undefined,
  prefixSink?: Map<string, string>,
): Promise<RdfStore> => {
  if (isRdfSourceList(source)) {
    const stores = await Promise.all(
      source.map((nestedSource) =>
        resolveRdfSource(nestedSource, quadCache, corsProxyUrl, prefixSink)
      ),
    );
    const merged = RdfStore.createDefault();
    for (const store of stores) {
      for (const quad of store.getQuads()) merged.addQuad(quad);
    }
    return merged;
  }

  const store = source instanceof RdfStore
    ? source
    : source instanceof URL
    ? await dereferenceUrl(source, quadCache, corsProxyUrl, prefixSink)
    : Array.isArray(source)
    ? storeFromQuads(source)
    : typeof source === "string"
    ? await parseRdfText(source, prefixSink)
    : storeFromQuads(source);

  await resolveOwlImports(store, quadCache, new Set<string>(), corsProxyUrl, prefixSink);
  return store;
};

export const resolveRdfSources = async (
  raw: RawEnvironment,
): Promise<Environment> => {
  const quadCache = new Map<string, Promise<Quad[]>>();
  // Shared by both graphs (rather than one Map each) so a source URL dereferenced once for, say,
  // shapesGraph but then cache-hit by dataGraph's own resolveRdfSource call still contributes its
  // `@prefix` declarations to the result - see dereferenceUrl's doc comment.
  const sourcePrefixes = new Map<string, string>();
  const { corsProxyUrl } = raw;
  const [resolvedShapesGraph, dataGraph, scoresGraph, readOnlyGraph] =
    await Promise.all([
      resolveRdfSource(raw.shapesGraph, quadCache, corsProxyUrl, sourcePrefixes),
      resolveRdfSource(raw.dataGraph, quadCache, corsProxyUrl, sourcePrefixes),
      resolveRdfSource(raw.scoresGraph, quadCache, corsProxyUrl),
      raw.readOnlyGraph !== undefined
        ? resolveRdfSource(raw.readOnlyGraph, quadCache, corsProxyUrl)
        : undefined,
    ]);

  const shapesGraph = resolvedShapesGraph.size === 0
    ? ((await dereferenceShapeTargets(dataGraph, quadCache, corsProxyUrl, sourcePrefixes)) ??
      resolvedShapesGraph)
    : resolvedShapesGraph;

  let nodeShapes: Quad_Subject[] = [];
  if (!raw.nodeShapes?.length) {
    nodeShapes = shapesGraph
      .getQuads(null, rdf("type"), sh("NodeShape"), null)
      .map((quad) => quad.subject);
  }

  return {
    ...raw,
    shapesGraph,
    dataGraph,
    scoresGraph,
    readOnlyGraph,
    nodeShapes: raw.nodeShapes?.length ? raw.nodeShapes : nodeShapes,
    sourcePrefixes: Object.fromEntries(sourcePrefixes),
  };
};
