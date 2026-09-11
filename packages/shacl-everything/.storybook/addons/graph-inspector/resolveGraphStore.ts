import type { DatasetCore, Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { parseRdf } from "../../../src/helpers/rdf.ts";

// Same "a non-empty array is a Quad[] only if its first element looks like a Quad, otherwise it's
// a list of sources to merge" disambiguation as resolveGraphText.ts/resolveRdfSources.ts.
const isQuad = (value: unknown): value is Quad =>
  value !== null &&
  typeof value === "object" &&
  "subject" in value &&
  "predicate" in value &&
  "object" in value &&
  "graph" in value;

const isSourceList = (source: unknown): source is readonly unknown[] =>
  Array.isArray(source) && source.length > 0 && !isQuad(source[0]);

const fetchText = async (url: URL): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url.href}: ${response.status} ${response.statusText}`);
  }
  return response.text();
};

/**
 * Best-effort resolution of a story's raw shapesGraph/dataGraph arg (same union resolveGraphText.ts
 * turns into display text) into a plain, queryable RdfStore, so the graph-inspector panel can feed
 * it to the library's own spec-usage/pattern analysis (analyzeSpecUsage/detectPatterns in
 * src/analysis/). A lighter-weight sibling of the library's internal
 * preprocess/resolveRdfSources.ts - no owl:imports resolution, CORS proxying, or fetch retries,
 * since this is only for this dev-only inspector, not the actual rendered environment.
 */
export const resolveGraphStore = async (source: unknown): Promise<RdfStore> => {
  if (source === undefined) return RdfStore.createDefault();

  if (isSourceList(source)) {
    const stores = await Promise.all(source.map((nested) => resolveGraphStore(nested)));
    const merged = RdfStore.createDefault();
    for (const store of stores) {
      for (const quad of store.getQuads()) merged.addQuad(quad);
    }
    return merged;
  }

  if (source instanceof RdfStore) return source;

  if (source instanceof URL) {
    // Same "strip the fragment" trick as resolveGraphText.ts/resolveRdfSources.ts.
    const hashlessUrl = new URL(source.href.split("#")[0]);
    return parseRdf(await fetchText(hashlessUrl), "text/turtle");
  }

  if (Array.isArray(source)) {
    const store = RdfStore.createDefault();
    for (const quad of source as Quad[]) store.addQuad(quad);
    return store;
  }

  if (typeof source === "string") return parseRdf(source, "text/turtle");

  // Whatever's left is a DatasetCore - iterate it directly into a store.
  const store = RdfStore.createDefault();
  for (const quad of source as DatasetCore) store.addQuad(quad);
  return store;
};
