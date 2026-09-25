import type { NamedNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { dash, sh } from "@/helpers/namespaces.ts";

// Split out of PropertyUIElement.ts so resolution/label.ts (which PropertyUIElement itself
// imports for label()/description()) can read raw values without importing PropertyUIElement back
// - the structural type below is all it needs.
export type ShapeValueSource = {
  propertyShapes: Term[];
  shapesGraph: RdfStore;
};

function shapeOrder(shape: Term, shapesGraph: RdfStore): number {
  const value = shapesGraph.getQuads(shape, sh("order"))[0]?.object.value;
  const parsed = value !== undefined ? parseFloat(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

// A handful of SHACL 1.2 Core predicates were promoted from the legacy DASH vocabulary
// (http://datashapes.org/dash#) with the same local name and semantics - a shape authored against
// DASH still uses the dash: form. orderedValues() falls back to a shape's dash: value when its
// sh: value is absent, so both forms read the same. Keep this list to only pairs actually confirmed
// equivalent (not just same local name) - guessing wrong here would silently misread a shape.
const DASH_ALIASES = new Map<string, NamedNode>([
  [sh("singleLine").value, dash("singleLine")],
  [sh("rootClass").value, dash("rootClass")],
]);

// Raw values for `predicate` across every grouped shape, in ascending sh:order - the ordering
// both a keepFirst-style resolution and language selection rely on to break ties consistently.
// Used by propertyLabel (resolution/label.ts), which needs the raw, un-language-resolved list
// itself (to try a strict language match first, falling back to the ontology before a looser one).
export function orderedValues(
  element: ShapeValueSource,
  predicate: NamedNode,
): Term[] {
  const orderedShapes = [...element.propertyShapes].sort(
    (a, b) =>
      shapeOrder(a, element.shapesGraph) - shapeOrder(b, element.shapesGraph),
  );
  const alias = DASH_ALIASES.get(predicate.value);
  return orderedShapes.flatMap((shape) => {
    const values = element.shapesGraph.getQuads(shape, predicate).map((quad) => quad.object);
    return values.length || !alias
      ? values
      : element.shapesGraph.getQuads(shape, alias).map((quad) => quad.object);
  });
}
