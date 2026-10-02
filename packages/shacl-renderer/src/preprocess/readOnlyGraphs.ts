import { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import { getReadOnlyGraphs } from "@/resolution/globalConfiguration.ts";

// shui:readOnlyGraph (3.4): every dataGraph triple in one of the configured named graphs is copied
// into Environment.readOnlyGraph (alongside whatever the caller already supplied there), so the
// existing read-only handling - viewer instead of editor, no remove control, see
// PropertyUIElement.isReadOnly() - applies to them as well. Runs before resolveScoresGraph, which
// only adds the viewer scoring rules edit mode then needs when readOnlyGraph is set.
export const resolveReadOnlyGraphs: Preprocessor = (environment) => {
  const { shapesGraph, dataGraph, readOnlyGraph } = environment;
  if (!(shapesGraph instanceof RdfStore) || !(dataGraph instanceof RdfStore)) return environment;
  const graphs = getReadOnlyGraphs(shapesGraph);
  if (graphs.length === 0) return environment;

  const merged = RdfStore.createDefault();
  if (readOnlyGraph instanceof RdfStore) {
    for (const quad of readOnlyGraph.getQuads()) merged.addQuad(quad);
  }
  for (const graph of graphs) {
    for (const quad of dataGraph.getQuads(null, null, null, graph)) merged.addQuad(quad);
  }
  return { ...environment, readOnlyGraph: merged };
};
