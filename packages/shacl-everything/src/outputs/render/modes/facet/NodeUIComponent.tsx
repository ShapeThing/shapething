import { useEffect, useMemo, useRef, useState } from "react";
import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { facetableRootShapes, targetsOfShape } from "@/resolution/targets.ts";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import {
  pathSparqlFor,
  removeFilterConstraintsForPaths,
  type FilterShape,
} from "@/structure/filterShape.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import FacetPropertyComponent from "@/outputs/render/modes/facet/FacetPropertyComponent.tsx";
import TypeSelector from "@/outputs/render/modes/facet/TypeSelector.tsx";

// The class a root shape represents for the type/category selector - its own sh:targetClass when
// declared, otherwise the shape node itself (an implicit class-shape, see
// resolution/targets.ts's facetableRootShapes 3.1.3.3 handling - the shape IS the class there).
function classFor(rootShape: Quad_Subject, shapesGraph: RdfStore): Term {
  return shapesGraph.getQuads(rootShape, sh("targetClass"))[0]?.object ?? rootShape;
}

function orderOf(property: PropertyUIElement): number {
  return property.get(sh("order")) ?? 0;
}

/**
 * Facet mode's entry point (the counterpart to edit/view's own NodeUIComponent) - but there is no
 * single focusNode to build one NodeUIElement from, so this discovers every facetable root shape
 * in shapesGraph instead (see facetableRootShapes), then either lets the user pick one when more
 * than one exists (TypeSelector - the default) or, when Environment.enableFacetTypeUnion is true,
 * renders every discovered root shape's properties together with no type picker at all (see that
 * flag's own doc comment in environment.ts). Either way this renders one FacetPropertyComponent
 * per property of whichever root shape(s) are currently active. No sh:or/sh:xone support
 * (ChoiceElement is simply filtered out) and no sh:group support - both out of scope for this
 * first pass (see the plan's scope decisions).
 */
export default function NodeUIComponent({ filterShape }: { filterShape: FilterShape }) {
  const {
    shapesGraph,
    dataGraph,
    scoresGraph,
    widgets,
    nodeShapes,
    enableFacetTypeUnion,
    enableFacetOptionCounts,
  } = useEnvironment();

  const rootShapes = useMemo(() => {
    const discovered = facetableRootShapes(shapesGraph);
    // nodeShapes acts as an optional allow-list in facet mode (see preprocess/configuration.ts) -
    // empty (the default) means "every discovered root shape".
    const allowList = new Set(nodeShapes.map((shape) => shape.value));
    return allowList.size > 0
      ? discovered.filter((shape) => allowList.has(shape.value))
      : discovered;
  }, [shapesGraph, nodeShapes]);

  const [selectedRootShape, setSelectedRootShape] = useState<Quad_Subject | undefined>(
    () => rootShapes[0],
  );
  const activeRootShape = selectedRootShape ?? rootShapes[0];

  // In union mode every discovered root shape is "active" at once, instead of only the one
  // TypeSelector picked - childrenForShape already merges co-path property shapes across a whole
  // array of shapes (the same mechanism a single shape's own sh:and/sh:node recursion uses), so
  // passing it every root shape here is all "union of properties, deduplicated by path" needs.
  const activeShapes = useMemo(
    () => (enableFacetTypeUnion ? rootShapes : activeRootShape ? [activeRootShape] : []),
    [enableFacetTypeUnion, rootShapes, activeRootShape],
  );

  const placeholderFocusNode = useMemo(() => factory.blankNode(), []);

  const properties = useMemo(() => {
    if (activeShapes.length === 0) return [];
    return childrenForShape(
      shapesGraph,
      dataGraph,
      activeShapes,
      placeholderFocusNode,
      scoresGraph,
      widgets,
    )
      .filter((element): element is PropertyUIElement => element.kind === "property")
      .sort((a, b) => orderOf(a) - orderOf(b));
  }, [shapesGraph, dataGraph, scoresGraph, widgets, activeShapes, placeholderFocusNode]);

  // Prunes filterShape.store down to the intersection whenever the user switches the active root
  // shape (TypeSelector): a constraint whose path belonged only to the previously selected type -
  // and isn't one of the newly selected type's own properties - is stale (its property no longer
  // renders here) and must not silently keep riding along in what index.tsx eventually submits.
  // Keyed on activeRootShape's own identity, not `properties`, so a re-score/widget-registry change
  // on the *same* type never mistakes itself for a type switch and prunes nothing. Meaningless (and
  // skipped) in union mode: every root shape's properties are always active together there, so
  // there is no "switch" to react to and nothing is ever stale.
  const previousTypeRef = useRef<{ rootShape: Quad_Subject; paths: Set<string> } | null>(null);
  useEffect(() => {
    if (enableFacetTypeUnion || !activeRootShape) return;
    const currentPaths = new Set(
      properties
        .map((property) => pathSparqlFor(property))
        .filter((path): path is string => path !== undefined),
    );

    const previous = previousTypeRef.current;
    previousTypeRef.current = { rootShape: activeRootShape, paths: currentPaths };
    if (!previous || previous.rootShape === activeRootShape) return;

    const stalePaths = new Set([...previous.paths].filter((path) => !currentPaths.has(path)));
    removeFilterConstraintsForPaths(filterShape, stalePaths);
  }, [enableFacetTypeUnion, activeRootShape, properties, filterShape]);

  // The instances facet widgets aggregate data-derived values/ranges from (structure/
  // facetValues.ts): every active shape's own targets, unioned - in union mode that's every
  // discovered type's instances together, since a property only some of them have (e.g. Product's
  // own schema:category) should still see Product's instances' actual category values even though
  // Person instances contribute nothing for that particular facet.
  const instances = useMemo(
    () =>
      dedupeTerms(
        activeShapes.flatMap((shape) => targetsOfShape(shape, shapesGraph, dataGraph)),
      ) as Quad_Subject[],
    [activeShapes, shapesGraph, dataGraph],
  );

  // TypeSelector's own "(n)" counts (Environment.enableFacetOptionCounts) - each root shape's own
  // target-instance count, keyed by termKey(classFor(rootShape)) the same way CategoryFacet keys
  // its own valueCounts, since a root shape's "value" in that radio/checkbox group is its class.
  const rootShapeCounts = useMemo(() => {
    if (!enableFacetOptionCounts) return undefined;
    const counts = new Map<string, number>();
    for (const rootShape of rootShapes) {
      counts.set(
        termKey(classFor(rootShape, shapesGraph)),
        targetsOfShape(rootShape, shapesGraph, dataGraph).length,
      );
    }
    return counts;
  }, [enableFacetOptionCounts, rootShapes, shapesGraph, dataGraph]);

  if (activeShapes.length === 0) return null;

  // Union mode has no type switcher and no synthetic rdf:type facet at all - every ordinary facet
  // below is itself an implicit type selector (see enableFacetTypeUnion's own doc comment), so the
  // per-property key only needs to stay stable within a single (always-identical) active shape
  // set, not vary across a "type switch" that can no longer happen.
  const facetKeyPrefix = enableFacetTypeUnion ? "union" : (activeRootShape?.value ?? "");

  return (
    <div className="st-facet-node-ui-component">
      {!enableFacetTypeUnion && rootShapes.length > 1 && activeRootShape && (
        <TypeSelector
          rootShapes={rootShapes}
          classFor={(rootShape) => classFor(rootShape, shapesGraph)}
          dataGraph={dataGraph}
          scoresGraph={scoresGraph}
          widgets={widgets}
          filterShape={filterShape}
          selectedRootShape={activeRootShape}
          onSelectRootShape={setSelectedRootShape}
          valueCounts={rootShapeCounts}
        />
      )}
      {properties.map((property, index) => (
        // Keyed on the active root shape too, not just position: several facet widgets (text
        // search, number/date range) keep their typed-but-not-yet-committed text as local
        // component state rather than deriving it from the filter shape's own store (see e.g.
        // TextSearchFacet), so an index-only key would let React reuse the same widget instance -
        // and its stale local state - across a type switch, even though the property at that
        // position now means something completely different (and its old constraint was just
        // pruned above). Forcing a fresh mount per root shape resets that local state along with it.
        <FacetPropertyComponent
          key={`${facetKeyPrefix}|${pathSparqlFor(property) ?? index}`}
          property={property}
          filterShape={filterShape}
          instances={instances}
        />
      ))}
    </div>
  );
}
