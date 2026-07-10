import "@/polyfills/ensureProcess.ts";
import "@/polyfills/ensureBuffer.ts";
import type { Quad, Stream } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { rdfParser } from "rdf-parse";
import stringToStream from "string-to-stream";
import type { Environment } from "@/environment.ts";
import type { Preprocessor } from "@/preprocess/index.ts";
import type { RdfSource } from "@/types/RdfSource.ts";

export type DereferencableEnvironment =
  & Omit<Environment, "shapesGraph" | "dataGraph" | "scoresGraph">
  & {
    shapesGraph: RdfSource;
    dataGraph: RdfSource;
    scoresGraph: RdfSource;
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

const dereferenceUrl = async (url: URL): Promise<RdfStore> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to dereference ${url.href}: ${response.status} ${response.statusText}`,
    );
  }
  const text = await response.text();
  return storeFromStream(
    rdfParser.parse(stringToStream(text), {
      path: url.href,
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

export const resolveRdfSources: Preprocessor<
  DereferencableEnvironment,
  Environment
> = async (raw) => {
  const [shapesGraph, dataGraph, scoresGraph] = await Promise.all([
    resolveRdfSource(raw.shapesGraph),
    resolveRdfSource(raw.dataGraph),
    resolveRdfSource(raw.scoresGraph),
  ]);

  return { ...raw, shapesGraph, dataGraph, scoresGraph };
};
