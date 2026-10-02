import type { Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import type { RawEnvironment } from "@/environment.ts";

const has = (store: RdfStore | undefined, quad: Quad) =>
  store !== undefined &&
  store.getQuads(quad.subject, quad.predicate, quad.object, quad.graph).length > 0;

/**
 * Environment.additionsGraph/deletionsGraph (view mode only): splits the change into the data as it
 * is now (`diffGraphs.current`) and as it was before (`diffGraphs.previous` - now, minus the
 * additions, plus the deletions), and widens dataGraph itself to now-plus-deletions, so a removed
 * value is still there to render (struck through - see view mode's PropertyUIComponent).
 *
 * `current` is derived as dataGraph minus the deletions rather than taken as-is, so this step is
 * idempotent: re-preprocessing an Environment whose dataGraph is already widened (see
 * runPreprocessors' keepDataGraph) arrives at the same split.
 */
export const resolveDiffGraphs = (environment: RawEnvironment): RawEnvironment => {
  const { mode, additionsGraph, deletionsGraph, dataGraph } = environment;
  if (mode !== "view" || (additionsGraph === undefined && deletionsGraph === undefined)) {
    return environment;
  }
  if (!(dataGraph instanceof RdfStore)) return environment;
  const additions = additionsGraph instanceof RdfStore ? additionsGraph : undefined;
  const deletions = deletionsGraph instanceof RdfStore ? deletionsGraph : undefined;

  const current = RdfStore.createDefault();
  const previous = RdfStore.createDefault();
  for (const quad of dataGraph.getQuads()) {
    if (has(deletions, quad)) continue;
    current.addQuad(quad);
    if (!has(additions, quad)) previous.addQuad(quad);
  }
  const widened = RdfStore.createDefault();
  for (const quad of current.getQuads()) widened.addQuad(quad);
  for (const quad of deletions?.getQuads() ?? []) {
    previous.addQuad(quad);
    widened.addQuad(quad);
  }

  return { ...environment, dataGraph: widened, diffGraphs: { current, previous } };
};
