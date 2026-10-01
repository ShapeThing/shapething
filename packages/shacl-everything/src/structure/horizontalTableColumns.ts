import type { Quad_Subject } from "@rdfjs/types";
import { sh, st } from "@/helpers/namespaces.ts";
import { groupChildren } from "@/structure/groupChildren.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * The columns of a repeating value list that renders as a compact table: one header row with
 * these columns' labels, every item below it label-less (see memberShapeTableContext). Applies
 * when `element`'s sh:node shape(s) collapse into exactly one st:HorizontalPropertyGroup of plain
 * properties - shared by MemberShapeList (an rdf:List via sh:memberShape, `element` being the
 * member element) and PropertyUIComponentValues (an ordinary multi-valued property, `element`
 * being the property itself).
 *
 * Computed purely from shape structure via an inert placeholder NodeUIElement/groupChildren pass -
 * the same technique ValueTableViewer already uses for its own headers - never from any item's
 * actual data, so callers only need to recompute it when the shape itself changes. Anything else
 * (no sh:node, more than one top-level child, a non-horizontal or nested group, a mix of
 * grouped/ungrouped children) returns undefined: per-item rendering, unchanged.
 */
export function horizontalTableColumns(
  element: PropertyUIElement,
): PropertyUIElement[] | undefined {
  const nodeShapes = element.get(sh("node")) as Quad_Subject[];
  if (nodeShapes.length === 0) return undefined;

  const placeholder = new NodeUIElement({
    shapesGraph: element.shapesGraph,
    dataGraph: element.dataGraph,
    scoresGraph: element.scoresGraph,
    widgetRegistry: element.widgetRegistry,
    focusNode: element.focusNode,
    nodeShapes,
  });
  const grouped = groupChildren(
    placeholder.children(),
    placeholder.shapesGraph,
    placeholder.dataGraph,
    placeholder.focusNode,
    placeholder.widgetRegistry,
  );
  if (grouped.length !== 1 || grouped[0].kind !== "group") return undefined;

  const [group] = grouped;
  if (!group.widget()?.widget.equals(st("HorizontalPropertyGroup"))) return undefined;
  if (group.children.some((child) => child.kind !== "property")) return undefined;

  return group.children as PropertyUIElement[];
}
