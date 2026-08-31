import type { NamedNode, Term } from "@rdfjs/types";
import { getRdfList } from "@/helpers/rdfList.ts";
import { sh } from "@/helpers/namespaces.ts";
import { validate } from "@/scoring/score.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

export type LogicalConnective = "or" | "xone";

// xone is treated the same as or for picker UX (pick one branch) - mirrors ChoiceElement's
// CHOICE_CONNECTIVES grouping for the node-level case.
const LOGICAL_CONNECTIVES: LogicalConnective[] = ["or", "xone"];

export type LogicalBranch = {
  shape: Term;
  connective: LogicalConnective;
};

/**
 * The sh:or/sh:xone branches declared directly on a property shape (constraining that property's
 * value, as opposed to a node-level sh:or/sh:xone, which is handled separately by ChoiceElement).
 * Each branch is a constraint-only shape node (e.g. `[ sh:datatype xsd:string ]`), not a full
 * property shape - it has no sh:path of its own.
 */
export function logicalBranches(element: PropertyUIElement): LogicalBranch[] {
  return LOGICAL_CONNECTIVES.flatMap((connective) =>
    element
      .get(sh(connective))
      .flatMap((list) => getRdfList(list, element.shapesGraph))
      .map((shape) => ({ shape, connective })),
  );
}

/**
 * A view of `element` as if `branch`'s own direct triples (e.g. sh:datatype) were declared
 * alongside the property shape(s) it's grouped from - reusing PropertyUIElement.get()/widget()/
 * getDefaultObject()'s existing support for merging constraints across multiple grouped shapes.
 * Safe because path resolution only ever reads propertyShapes[0], which stays untouched here.
 */
export function withBranch(element: PropertyUIElement, branch: Term): PropertyUIElement {
  return new PropertyUIElement({
    shapesGraph: element.shapesGraph,
    dataGraph: element.dataGraph,
    scoresGraph: element.scoresGraph,
    widgetRegistry: element.widgetRegistry,
    focusNode: element.focusNode,
    propertyShapes: [...element.propertyShapes, branch as NamedNode],
  });
}

/**
 * A plain-object value's own sh:node is usually declared directly on the property, but a
 * property-level sh:or/sh:xone can instead put it on just one branch (e.g. "either a nested
 * address object, or a plain address string") - since the caller already knows it's holding (or
 * building) an object-shaped value, the object-shaped branch is the one that must have been
 * intended. Picks the first branch (in declaration order) that declares an sh:node, same as
 * detectActiveBranch's own first-match convention; ambiguous between two object-shaped branches,
 * but that's no different a case than a plain value matching more than one scalar branch. Shared
 * by jsToRdf (writing a plain object) and rdfToJs (reading a BlankNode value) so the two stay in
 * sync about where an embedded object's shape comes from.
 */
export function resolveNodeShapes(property: PropertyUIElement): Term[] {
  const direct = property.get(sh("node")) as Term[];
  if (direct.length > 0) return direct;

  for (const branch of logicalBranches(property)) {
    const branchNodeShapes = withBranch(property, branch.shape).get(sh("node")) as Term[];
    if (branchNodeShapes.length > 0) return branchNodeShapes;
  }

  return [];
}

/**
 * Which of `branches` the given value already conforms to - used to pre-select the dropdown for
 * a property that already has a value, without needing to persist "which branch was chosen"
 * anywhere: the data itself already conforms to exactly one branch (when the shape is well-formed).
 */
export async function detectActiveBranch(
  element: PropertyUIElement,
  term: Term,
  branches: LogicalBranch[],
): Promise<LogicalBranch | undefined> {
  for (const branch of branches) {
    const conforms = await validate({
      focusNode: term,
      targetGraph: element.dataGraph,
      shapeNode: branch.shape,
      shapesGraph: element.shapesGraph,
    });
    if (conforms) return branch;
  }
  return undefined;
}
