import { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import { getScoringGraph } from "@/widgets/registry.ts";

// Callers only need to supply scoresGraph explicitly when they want to override the built-in
// shui widget scoring rules - otherwise it's derived from the bundled editors/viewers for the
// environment's mode. Facet mode has no scoring rules of its own yet, so it's left untouched.
export const resolveScoresGraph: Preprocessor = async (environment) => {
  const hasScoresGraph =
    environment.scoresGraph instanceof RdfStore && environment.scoresGraph.size > 0;
  if (environment.mode === "facet" || hasScoresGraph) {
    return environment;
  }

  return { ...environment, scoresGraph: await getScoringGraph(environment.mode) };
};
