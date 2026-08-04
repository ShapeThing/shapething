import { sh, shui } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * The raw SPARQL text of this property's `sh:in [ shui:searchQuery "..." ]`, if declared - lets a
 * shape writer hand the renderer a concrete fulltext-search query (e.g. against a vendor's own
 * text index) instead of the renderer's own local IRI/LabelRole search (see query.ts's
 * searchInstances). Mirrors EnumSelectEditor/selectQuery.ts's
 * selectQueryFor - shui:searchQuery is asserted on the same sh:in blank node, just with a
 * different predicate.
 */
export function searchQueryFor(shape: PropertyUIElement): string | undefined {
  const [only, ...rest] = shape.get(sh("in"));
  if (!only || rest.length > 0 || only.termType !== "BlankNode") return undefined;

  const literal = shape.shapesGraph.getQuads(only, shui("searchQuery"))[0]?.object;
  return literal?.termType === "Literal" ? literal.value : undefined;
}
