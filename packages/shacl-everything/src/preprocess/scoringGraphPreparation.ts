import type { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import { prepareScoringGraph } from "@/scoring/score.ts";

// Runs Scoring Graph Preparation (spec §4.3) once per environment, after shapesGraph/scoresGraph
// are both resolved - score()/select() require an already-prepared scoring graph, and
// prepareScoringGraph() depends only on these two graphs, so there's no benefit to redoing this
// per property the way PropertyUIElement.widget()/widgets() call score()/select() themselves.
// Facet mode has no scoring rules to prepare against (see resolveScoresGraph).
//
// Must run after resolveRdfSources (so both graphs are resolved RdfStores, even though
// RawEnvironment's type still allows an unresolved RdfSource) and after addMissingShapes (so any
// shapes it adds are covered too).
export const prepareEnvironmentScoringGraph: Preprocessor = (environment) => {
  if (environment.mode === "facet") return environment;

  return {
    ...environment,
    scoresGraph: prepareScoringGraph({
      shapesGraph: environment.shapesGraph as RdfStore,
      scoringGraph: environment.scoresGraph as RdfStore,
    }),
  };
};
