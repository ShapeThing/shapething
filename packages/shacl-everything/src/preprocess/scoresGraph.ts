import { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import { getScoringGraph, type WidgetMode } from "@/widgets/registry.ts";
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

  const widgets = environment.widgets as Widgets;

  // Edit mode normally only needs editor widget scoring - but when readOnlyGraph is configured, a
  // value found there needs to resolve a shui:viewer widget too (see PropertyUIElement.isReadOnly()/
  // outputs/render/modes/edit/WidgetSlot.tsx), which requires viewer score.ttl rules to be present
  // in this same scoresGraph (there is only ever this one - see scoring/score.ts's score(), which
  // filters by category itself rather than relying on separate graphs per category).
  const modes: WidgetMode[] =
    environment.mode === "edit" && environment.readOnlyGraph !== undefined
      ? ["edit", "view"]
      : [environment.mode];

  if (modes.length === 1) {
    return { ...environment, scoresGraph: await getScoringGraph(modes[0], widgets) };
  }

  const scoresGraph = RdfStore.createDefault();
  for (const mode of modes) {
    for (const quad of (await getScoringGraph(mode, widgets)).getQuads()) {
      scoresGraph.addQuad(quad);
    }
  }
  return { ...environment, scoresGraph };
};
