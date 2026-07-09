import type { RdfStore } from "rdf-stores";
import { parseRdf } from "../helpers/rdf.ts";
import widgetScoringTtl from "../scoring/widget-scoring.ttl?raw";

export const shuiEditorsScoringGraphs = import.meta.glob(
  "./implementations/shui/editors/*/score.ttl",
  { eager: true, query: "?raw", import: "default" },
);
export const shuiViewersScoringGraphs = import.meta.glob(
  "./implementations/shui/viewers/*/score.ttl",
  { eager: true, query: "?raw", import: "default" },
);

export type WidgetMode = "edit" | "view";

/**
 * Combines the shared widget-scoring.ttl shape definitions with every
 * per-widget score.ttl for the given mode into a single scoring graph.
 */
export async function getScoringGraph(mode: WidgetMode): Promise<RdfStore> {
  const widgetScoringGraphs = mode === "edit" ? shuiEditorsScoringGraphs : shuiViewersScoringGraphs;

  const turtle = [widgetScoringTtl, ...(Object.values(widgetScoringGraphs) as string[])].join("\n");

  return parseRdf(turtle, "text/turtle");
}
