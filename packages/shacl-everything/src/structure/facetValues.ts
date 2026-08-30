import type { Quad_Subject, Term } from "@rdfjs/types";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * Every value found for `property`'s path across every one of `instances`, in `property.dataGraph`
 * - the facet-mode analogue of PropertyUIElement.getObjects(), which only ever reads from a single
 * `focusNode`. Facet mode has no single focus node (see resolution/targets.ts's
 * facetableRootShapes) - a facet widget needs to see the value distribution across every target
 * instance instead, to derive range bounds (NumberRangeFacet/DateRangeFacet) or a distinct option
 * list (CategoryFacet) from the actual data rather than just the shape's own declared metadata.
 */
export function aggregateFacetValues(
  property: PropertyUIElement,
  instances: Quad_Subject[],
): Term[] {
  const path = parsePropertyPath(property.propertyShapes[0], property.shapesGraph);
  if (!path) return [];

  return dedupeTerms(
    instances.flatMap((instance) => walkPropertyPath(path, instance, property.dataGraph)),
  );
}
