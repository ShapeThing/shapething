import { shui } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * The raw SPARQL text of this property's `shui:searchQuery`, if declared - lets a shape writer
 * hand the renderer a concrete fulltext-search query (e.g. against a vendor's own text index)
 * instead of the renderer's own local IRI/LabelRole search (see query.ts's searchInstances).
 * Asserted directly on the property shape (spec §10.1) - independent of sh:in, unlike
 * EnumSelectEditor/selectQuery.ts's selectQueryFor, which reads sh:in's own sh:select off the
 * sh:in blank node itself.
 */
export function searchQueryFor(shape: PropertyUIElement): string | undefined {
  const literal = shape.get(shui("searchQuery"))[0];
  return literal?.termType === "Literal" ? literal.value : undefined;
}
