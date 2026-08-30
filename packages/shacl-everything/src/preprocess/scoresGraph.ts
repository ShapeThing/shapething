import { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import { getScoringGraph } from "@/widgets/registry.ts";
import type { Widgets } from "@/widgets/types.ts";

// Callers only need to supply scoresGraph explicitly when they want to override the built-in
// shui/st widget scoring rules - otherwise it's derived from the environment's own (bundled or
// custom, see resolveWidgets) editors/viewers/facets for the environment's mode.
export const resolveScoresGraph: Preprocessor = async (environment) => {
  const hasScoresGraph =
    environment.scoresGraph instanceof RdfStore && environment.scoresGraph.size > 0;
  if (hasScoresGraph) {
    return environment;
  }

  return {
    ...environment,
    scoresGraph: await getScoringGraph(environment.mode, environment.widgets as Widgets),
  };
};
