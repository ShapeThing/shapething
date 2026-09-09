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

// sh:targetWhere (3.1.3.6) fragment attachment is NOT resolved here - unlike everything else in
// this chain, it depends on dataGraph in a way that can change live while a form is open (e.g. a
// discriminator property being edited), so it's resolved reactively instead, per render, by
// outputs/render/hooks/useTargetWhereFragments.tsx (see modes/edit and modes/view's own
// NodeUIComponent.tsx for where that's folded into nodeShapes).
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
