import "@/polyfills/ensureProcess.ts";
import "@/polyfills/ensureBuffer.ts";
import type { Quad, Stream, Term } from "@rdfjs/types";
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

const dereferenceUrl = async (url: URL): Promise<RdfStore> => {
  const hashlessUrl = new URL(url.href.split("#")[0]);
  const response = await fetch(hashlessUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to dereference ${url.href}: ${response.status} ${response.statusText}`,
    );
  }

  const text = await response.text();
  return storeFromStream(
    rdfParser.parse(stringToStream(text), {
      path: hashlessUrl.href,
      baseIRI: url.href,
    }),
  );
};

const parseRdfText = (text: string): Promise<RdfStore> =>
  storeFromStream(
    rdfParser.parse(stringToStream(text), { contentType: "text/turtle" }),
  );

const resolveRdfSource = (source: RdfSource): RdfStore | Promise<RdfStore> => {
  if (source instanceof RdfStore) return source;
  if (source instanceof URL) return dereferenceUrl(source);
  if (Array.isArray(source)) return storeFromQuads(source);
  if (typeof source === "string") return parseRdfText(source);
  return storeFromQuads(source);
};

export const resolveRdfSources: Preprocessor = async (raw) => {
  const [shapesGraph, dataGraph, scoresGraph] = await Promise.all([
    resolveRdfSource(raw.shapesGraph),
    resolveRdfSource(raw.dataGraph),
    resolveRdfSource(raw.scoresGraph),
  ]);

  let nodeShapes: Term[] = [];
  if (!raw.nodeShapes?.length) {
    nodeShapes = shapesGraph.getQuads(null, rdf("type"), sh("NodeShape"), null)
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
