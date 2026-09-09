import type { Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { shapesWhereTargetingFocusNode } from "@/resolution/targets.ts";

// Must run after resolveRdfSources (so shapesGraph/dataGraph are resolved RdfStores, even though
// RawEnvironment's type still allows an unresolved RdfSource).
//
// structure/childrenForShape.ts only ever composes shapes it's explicitly handed (nodeShapes
// itself, or reachable from it via sh:and/sh:node/sh:or/sh:xone) - a shape that instead declares
// sh:targetWhere to describe the condition under which it applies has no such explicit link, so
// nothing downstream would ever render it. This step is what makes that conditional-attachment
// pattern work: once per environment (focusNode/shapesGraph/dataGraph don't change afterwards -
// see EnvironmentContextProvider's own doc comment on why), find every sh:targetWhere shape the
// resolved focusNode already conforms to and fold it into nodeShapes, so it renders exactly like
// any other explicitly-passed shape from here on. Facet mode has no single focus node (see
// preprocess/configuration.ts's own note on this) and is skipped.
export const resolveTargetWhereFragments: Preprocessor = async (environment) => {
  if (environment.mode === "facet") return environment;

  const shapesGraph = environment.shapesGraph as RdfStore;
  const dataGraph = environment.dataGraph as RdfStore;

  const fragments = await shapesWhereTargetingFocusNode(
    environment.focusNode,
    shapesGraph,
    dataGraph,
  );
  if (fragments.length === 0) return environment;

  return {
    ...environment,
    nodeShapes: dedupeTerms([...environment.nodeShapes, ...fragments]) as Quad_Subject[],
  };
};
