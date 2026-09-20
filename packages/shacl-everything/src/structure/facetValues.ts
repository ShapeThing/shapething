import type { Quad_Subject, Term } from "@rdfjs/types";
import { booleanWithin } from "@turf/turf";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { literalToGeometry } from "@/helpers/geometryLiteral.ts";
import { termKey } from "@/helpers/termKey.ts";
import { literalOrder } from "@/structure/constraintResolutions.ts";
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

/**
 * How many of `instances` have each distinct value for `property`'s path, keyed by termKey - the
 * count Environment.enableFacetOptionCounts shows next to a facet option (CategoryFacet).
 * Counts *instances*, not raw triples: an instance whose path happens to yield the same value more
 * than once (e.g. through a compound path with more than one matching branch) still only
 * contributes 1 to that value's count, matching "n things have this value" rather than "n triples
 * exist with this value".
 *
 * This function itself is a plain, static tally over whatever `instances` it's given - the *live*,
 * re-narrowing behavior (excluding instances that fail some other currently-active facet
 * constraint) lives one layer up, in the caller's choice of which instances to pass in: see
 * structure/filterShape.ts's instancesMatchingOtherConstraints, which FacetPropertyComponent runs
 * first and hands the result to this function instead of the full, unfiltered instance list.
 */
export function aggregateFacetValueCounts(
  property: PropertyUIElement,
  instances: Quad_Subject[],
): Map<string, number> {
  const path = parsePropertyPath(property.propertyShapes[0], property.shapesGraph);
  const counts = new Map<string, number>();
  if (!path) return counts;

  for (const instance of instances) {
    const instanceValues = dedupeTerms(walkPropertyPath(path, instance, property.dataGraph));
    for (const value of instanceValues) {
      const key = termKey(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

// The four independent, conjunctively-combined bounds a range-style facet constraint node can
// carry - mirrors the four range predicates constraintResolutions.ts's own `resolutions` map
// already recognizes at the shape-authoring level (sh:minInclusive/sh:maxInclusive/
// sh:minExclusive/sh:maxExclusive), so the facet-filter layer doesn't hardcode only the inclusive
// half of that set. An omitted bound imposes no constraint on that side.
export type RangeBounds = {
  minInclusive?: Term;
  maxInclusive?: Term;
  minExclusive?: Term;
  maxExclusive?: Term;
};

/**
 * How many of `instances` have at least one value for `property`'s path that satisfies every
 * bound in `bounds` - the range-facet analogue of aggregateFacetValueCounts's per-option counts,
 * backing Environment.enableFacetOptionCounts for NumberRangeFacet/DateRangeFacet/
 * DateTimeRangeFacet/ColorFacet. Counts *instances*, not values (the same per-instance fidelity
 * aggregateFacetValueCounts needs, for the same reason aggregateFacetValues's cross-instance
 * dedupe is unsuitable here) - an instance with more than one qualifying value still only counts
 * once, via `.some()`. Ordering uses constraintResolutions.ts's own literalOrder, the same
 * numeric-vs-date-vs-color-aware comparison the facet constraint's own conjunctive resolution
 * already relies on, reused here rather than reimplemented. Returns 0 when every bound is
 * undefined - callers gate on that themselves to distinguish "no filter entered yet" from "filter
 * matches nothing".
 *
 * Like aggregateFacetValueCounts, this is a plain static tally over whatever `instances` it's
 * given - the live, re-narrowing behavior comes from the caller passing in an already-narrowed
 * instance list (structure/filterShape.ts's instancesMatchingOtherConstraints), not from anything
 * this function does itself.
 */
export function countFacetInstancesInRange(
  property: PropertyUIElement,
  instances: Quad_Subject[],
  bounds: RangeBounds,
): number {
  const { minInclusive, maxInclusive, minExclusive, maxExclusive } = bounds;
  if (
    minInclusive === undefined &&
    maxInclusive === undefined &&
    minExclusive === undefined &&
    maxExclusive === undefined
  ) {
    return 0;
  }
  const path = parsePropertyPath(property.propertyShapes[0], property.shapesGraph);
  if (!path) return 0;

  const minInclusiveOrder = minInclusive !== undefined ? literalOrder(minInclusive) : undefined;
  const maxInclusiveOrder = maxInclusive !== undefined ? literalOrder(maxInclusive) : undefined;
  const minExclusiveOrder = minExclusive !== undefined ? literalOrder(minExclusive) : undefined;
  const maxExclusiveOrder = maxExclusive !== undefined ? literalOrder(maxExclusive) : undefined;

  return instances.filter((instance) =>
    walkPropertyPath(path, instance, property.dataGraph).some((value) => {
      const order = literalOrder(value);
      const aboveMin =
        (minInclusiveOrder === undefined || order >= minInclusiveOrder) &&
        (minExclusiveOrder === undefined || order > minExclusiveOrder);
      const belowMax =
        (maxInclusiveOrder === undefined || order <= maxInclusiveOrder) &&
        (maxExclusiveOrder === undefined || order < maxExclusiveOrder);
      return aboveMin && belowMax;
    }),
  ).length;
}

/**
 * How many of `instances` have at least one value for `property`'s path matching `pattern`
 * (an RDF regular expression, per sh:pattern/sh:flags) - the text-search analogue of
 * countFacetInstancesInRange, backing Environment.enableFacetOptionCounts for TextSearchFacet.
 * Counts *instances*, not values, the same way the other two count functions do. `pattern`
 * undefined means no search has been entered yet - returns 0, same "nothing entered" sentinel
 * countFacetInstancesInRange uses, for callers to gate on the same way.
 *
 * Like the other two count functions, this is a plain static tally over whatever `instances` it's
 * given - the live, re-narrowing behavior comes from the caller passing in an already-narrowed
 * instance list (structure/filterShape.ts's instancesMatchingOtherConstraints).
 */
export function countFacetInstancesMatchingPattern(
  property: PropertyUIElement,
  instances: Quad_Subject[],
  pattern: string | undefined,
  flags: string | undefined,
): number {
  if (pattern === undefined) return 0;
  const path = parsePropertyPath(property.propertyShapes[0], property.shapesGraph);
  if (!path) return 0;

  const regex = new RegExp(pattern, flags);
  return instances.filter((instance) =>
    walkPropertyPath(path, instance, property.dataGraph).some((value) => regex.test(value.value)),
  ).length;
}

/**
 * How many of `instances` have at least one value for `property`'s path falling inside `area` (a
 * GeoSPARQL WKT Polygon/MultiPolygon literal, MapFacet's own st:withinArea constraint value - see
 * structure/filterShape.ts) - the spatial analogue of countFacetInstancesInRange, backing
 * Environment.enableFacetOptionCounts for MapFacet. Counts *instances*, not values, the same way the
 * other count functions do. `area` undefined means nothing has been drawn yet - returns 0, the same
 * "nothing entered" sentinel the other count functions use.
 *
 * Uses @turf/turf's booleanWithin directly - the same real OGC "within" predicate
 * structure/filterShape.ts's matchingInstancesWithinArea reaches via geof:sfWithin/Comunica for the
 * cross-facet narrowing that feeds `instances` here, kept as one shared predicate (not a separate,
 * cheaper approximation) precisely so this facet's own displayed count can never disagree with what
 * a sibling facet's narrowing decided about the same instance.
 *
 * Like the other count functions, this is a plain static tally over whatever `instances` it's given
 * - the live, re-narrowing behavior comes from the caller passing in an already-narrowed instance
 * list (structure/filterShape.ts's instancesMatchingOtherConstraints).
 */
export function countFacetInstancesWithinArea(
  property: PropertyUIElement,
  instances: Quad_Subject[],
  area: Term | undefined,
): number {
  if (area === undefined) return 0;
  const areaGeometry = literalToGeometry(area);
  if (!areaGeometry) return 0;
  const path = parsePropertyPath(property.propertyShapes[0], property.shapesGraph);
  if (!path) return 0;

  return instances.filter((instance) =>
    walkPropertyPath(path, instance, property.dataGraph).some((value) => {
      const geometry = literalToGeometry(value);
      return geometry !== undefined && booleanWithin(geometry, areaGeometry);
    }),
  ).length;
}
