import "@/polyfills/ensureProcess.ts";
import "@/polyfills/ensureBuffer.ts";
import type { Quad, Quad_Subject, Stream } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { rdfParser } from "rdf-parse";
import stringToStream from "string-to-stream";
import type { Preprocessor } from "@/preprocess/index.ts";
import type { RdfSource } from "@/types/RdfSource.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";

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

const fetchText = async (url: URL): Promise<string> => {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url).catch((error: Error) => error);
    if (response instanceof Response && response.ok) return response.text();

    if (attempt >= RETRY_DELAYS_MS.length) {
      if (response instanceof Response) {
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
const dereferenceUrl = async (
  url: URL,
  quadCache: Map<string, Promise<Quad[]>>,
): Promise<RdfStore> => {
  const hashlessUrl = new URL(url.href.split("#")[0]);

  let quadsPromise = quadCache.get(hashlessUrl.href);
  if (!quadsPromise) {
    quadsPromise = (async () => {
      const text = await fetchText(hashlessUrl);
      const store = await storeFromStream(
        rdfParser.parse(stringToStream(text), {
          path: hashlessUrl.href,
          baseIRI: url.href,
        }),
      );
      return store.getQuads();
    })();
    quadCache.set(hashlessUrl.href, quadsPromise);
  }

  return storeFromQuads(await quadsPromise);
};

const parseRdfText = (text: string): Promise<RdfStore> =>
  storeFromStream(rdfParser.parse(stringToStream(text), { contentType: "text/turtle" }));

const resolveRdfSource = (
  source: RdfSource,
  quadCache: Map<string, Promise<Quad[]>>,
): RdfStore | Promise<RdfStore> => {
  if (source instanceof RdfStore) return source;
  if (source instanceof URL) return dereferenceUrl(source, quadCache);
  if (Array.isArray(source)) return storeFromQuads(source);
  if (typeof source === "string") return parseRdfText(source);
  return storeFromQuads(source);
};

export const resolveRdfSources: Preprocessor = async (raw) => {
  const quadCache = new Map<string, Promise<Quad[]>>();
  const [shapesGraph, dataGraph, scoresGraph] = await Promise.all([
    resolveRdfSource(raw.shapesGraph, quadCache),
    resolveRdfSource(raw.dataGraph, quadCache),
    resolveRdfSource(raw.scoresGraph, quadCache),
  ]);

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
    nodeShapes: raw.nodeShapes?.length ? raw.nodeShapes : nodeShapes,
  };
};
