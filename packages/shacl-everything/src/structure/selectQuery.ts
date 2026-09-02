import { sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * The raw SPARQL text of this property's `sh:in [ sh:select "..." ]`, if that's how its options
 * are declared - undefined for the plain rdf:List form of sh:in. sh:select is asserted on the
 * blank node in shapesGraph, not dataGraph - PropertyUIElement.get()'s sh:in resolution
 * (keepListIntersection/expandListOrTerm) only expands an actual rdf:List, so a sh:select blank
 * node comes back as-is: a single non-list term. Shared by EnumSelectEditor (edit mode's
 * federated dropdown) and CategoryFacet (facet mode's federated option list) - widget-agnostic on
 * purpose.
 */
export function selectQueryFor(shape: PropertyUIElement): string | undefined {
  const [only, ...rest] = shape.get(sh("in"));
  if (!only || rest.length > 0 || only.termType !== "BlankNode") return undefined;

  const literal = shape.shapesGraph.getQuads(only, sh("select"))[0]?.object;
  return literal?.termType === "Literal" ? literal.value : undefined;
}
