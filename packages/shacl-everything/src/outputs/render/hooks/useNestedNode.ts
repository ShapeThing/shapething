import { useMemo } from "react";
import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { termKey } from "@/helpers/termKey.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

export type NestedNodeOptions = {
  // The node shape(s) describing `focusNode` - each widget has its own rule for these (sh:node,
  // valueNodeShapes' sh:node-or-sh:class union, shapesTargetingNode for an arbitrary resource).
  nodeShapes: Term[];
  // True when the nested form is a hop *within* this property's own value (DetailsEditor/
  // DetailsViewer rendering the value's own fields inline), so its elements get
  // `shape.nestedAncestorPath()` (see PropertyUIElement.dataId()). False/omitted for a separate
  // resource opened on its own (view/edit/create-in-place modals), which starts a fresh path.
  nested?: boolean;
  // Renders against a different graph than `shape.dataGraph` - e.g. a create-in-place staging copy.
  dataGraph?: RdfStore;
};

/**
 * The NodeUIElement for a form nested under `shape` - a value's own fields, or a resource opened
 * from it - built from the parent property's own graphs and widget registry, so a widget never has
 * to thread shapesGraph/scoresGraph/widgetRegistry through by hand (and can't forget one).
 */
export function nestedNodeElement(
  shape: PropertyUIElement,
  focusNode: Term,
  { nodeShapes, nested, dataGraph }: NestedNodeOptions,
): NodeUIElement {
  return new NodeUIElement({
    shapesGraph: shape.shapesGraph,
    dataGraph: dataGraph ?? shape.dataGraph,
    scoresGraph: shape.scoresGraph,
    widgetRegistry: shape.widgetRegistry,
    focusNode: focusNode as Quad_Subject,
    nodeShapes: nodeShapes as Quad_Subject[],
    ancestorPath: nested ? shape.nestedAncestorPath() : undefined,
  });
}

/**
 * nestedNodeElement(), memoized - `undefined` whenever `focusNode` is (a widget passes undefined
 * while its nested form isn't open/applicable, keeping the hook call itself unconditional). Its
 * children() are memoized by structure/ anyway, but a stable NodeUIElement also keeps
 * description()/cssImports() lookups and any memo keyed on it from re-running every render.
 */
export function useNestedNode(
  shape: PropertyUIElement,
  focusNode: Term | undefined,
  options: NestedNodeOptions,
): NodeUIElement | undefined {
  const { nodeShapes, nested, dataGraph } = options;
  const focusKey = focusNode ? termKey(focusNode) : undefined;
  return useMemo(
    () => (focusNode ? nestedNodeElement(shape, focusNode, { nodeShapes, nested, dataGraph }) : undefined),
    // focusNode is keyed by termKey: a parent re-render may hand over an equal-but-new term object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape, focusKey, nodeShapes, nested, dataGraph],
  );
}
