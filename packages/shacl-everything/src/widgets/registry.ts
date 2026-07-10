import type { NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { localName } from "@/helpers/localName.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import type { ObjectWidgetComponent } from "@/widgets/types.ts";
import widgetScoringTtl from "@/scoring/widget-scoring.ttl?raw";

export const shuiEditorsScoringGraphs = import.meta.glob(
  "@/widgets/implementations/shui/editors/*/score.ttl",
  { eager: true, query: "?raw", import: "default" },
);
export const shuiViewersScoringGraphs = import.meta.glob(
  "@/widgets/implementations/shui/viewers/*/score.ttl",
  { eager: true, query: "?raw", import: "default" },
);

const shuiEditorsWidgets = import.meta.glob("@/widgets/implementations/shui/editors/*/widget.tsx", {
  eager: true,
  import: "default",
}) as Record<string, ObjectWidgetComponent>;
const shuiViewersWidgets = import.meta.glob("@/widgets/implementations/shui/viewers/*/widget.tsx", {
  eager: true,
  import: "default",
}) as Record<string, ObjectWidgetComponent>;

export type WidgetMode = "edit" | "view";

// widget-scoring.ttl and every score.ttl are static bundle contents - parsing them into an
// RdfStore is pure and mode-scoped, so repeat calls (one per property, on every render) reuse the
// same parsed graph instead of re-parsing the same turtle every time.
const scoringGraphCache = new Map<WidgetMode, Promise<RdfStore>>();

/**
 * Combines the shared widget-scoring.ttl shape definitions with every
 * per-widget score.ttl for the given mode into a single scoring graph.
 */
export function getScoringGraph(mode: WidgetMode): Promise<RdfStore> {
  const cached = scoringGraphCache.get(mode);
  if (cached) return cached;

  const widgetScoringGraphs = mode === "edit" ? shuiEditorsScoringGraphs : shuiViewersScoringGraphs;
  const turtle = [widgetScoringTtl, ...(Object.values(widgetScoringGraphs) as string[])].join("\n");
  const graph = parseRdf(turtle, "text/turtle");

  scoringGraphCache.set(mode, graph);
  return graph;
}

/**
 * Resolves a shui:widget IRI (as picked by PropertyUIElement.widget()) to the React component
 * implementing it, found by matching the widget's local name to its folder name under
 * widgets/implementations/shui/{editors,viewers}/*\/widget.tsx.
 */
export function getWidgetComponent(
  mode: WidgetMode,
  widget: NamedNode,
): ObjectWidgetComponent | undefined {
  const widgets = mode === "edit" ? shuiEditorsWidgets : shuiViewersWidgets;
  const folder = mode === "edit" ? "editors" : "viewers";
  const name = localName(widget);
  return widgets[`/src/widgets/implementations/shui/${folder}/${name}/widget.tsx`];
}
