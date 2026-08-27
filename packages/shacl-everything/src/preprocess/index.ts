import type { Environment, RawEnvironment } from "@/environment.ts";
import { resolveRdfSources } from "@/preprocess/resolveRdfSources.ts";
import { distillLanguages, distillInterfaceLanguages } from "@/preprocess/languages.ts";
import { resolveScoresGraph } from "@/preprocess/scoresGraph.ts";
import { resolveWidgets } from "@/preprocess/widgets.ts";
import { addMissingShapes } from "@/preprocess/shapes.ts";
import { prepareEnvironmentScoringGraph } from "@/preprocess/scoringGraphPreparation.ts";
import { assertValidEnvironment } from "@/preprocess/configuration.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";

export type Preprocessor = (
  environment: RawEnvironment,
) => RawEnvironment | Promise<RawEnvironment>;

export const defaultPreprocessors: readonly Preprocessor[] = [
  resolveRdfSources,
  distillLanguages,
  distillInterfaceLanguages,
  resolveWidgets,
  resolveScoresGraph,
  addMissingShapes,
  prepareEnvironmentScoringGraph,
];

export const runPreprocessors = async (
  raw: RawEnvironment,
  steps: readonly Preprocessor[] = defaultPreprocessors,
): Promise<Environment> => {
  let result = raw;

  for (const step of steps) {
    result = await step(result);
  }

  const environment = assertValidEnvironment(result);
  // Only dataGraph is written to at runtime (e.g. PropertyUIElement.addObject) - shapesGraph and
  // scoresGraph are read-only for the lifetime of an Environment, so they don't need reactivity.
  return { ...environment, dataGraph: makeReactive(environment.dataGraph) };
};
