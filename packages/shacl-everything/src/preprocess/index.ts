import type { Environment, RawEnvironment } from "@/environment.ts";
import { resolveRdfSources } from "@/preprocess/resolveRdfSources.ts";
import { resolveScoresGraph } from "@/preprocess/scoresGraph.ts";
import { addMissingShapes } from "@/preprocess/shapes.ts";
import { assertValidEnvironment } from "@/preprocess/configuration.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";

export type Preprocessor = (
  environment: RawEnvironment,
) => RawEnvironment | Promise<RawEnvironment>;

export const defaultPreprocessors: readonly Preprocessor[] = [
  resolveRdfSources,
  resolveScoresGraph,
  addMissingShapes,
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
