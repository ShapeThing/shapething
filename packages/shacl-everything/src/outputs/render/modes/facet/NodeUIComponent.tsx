import { useEffect, useMemo, useRef, useState } from "react";
import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
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
 * in shapesGraph instead (see facetableRootShapes), lets the user pick one when more than one
 * exists (TypeSelector), and renders one FacetPropertyComponent per property of the selected root
 * shape's sh:property list. No sh:or/sh:xone support (ChoiceElement is simply filtered out) and no
 * sh:group support - both out of scope for this first pass (see the plan's scope decisions).
 */
export default function NodeUIComponent({ filterShape }: { filterShape: FilterShape }) {
  const { shapesGraph, dataGraph, scoresGraph, widgets, nodeShapes } = useEnvironment();

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

  const placeholderFocusNode = useMemo(() => factory.blankNode(), []);

  const properties = useMemo(() => {
    if (!activeRootShape) return [];
    return childrenForShape(
      shapesGraph,
      dataGraph,
      [activeRootShape],
      placeholderFocusNode,
      scoresGraph,
      widgets,
    )
      .filter((element): element is PropertyUIElement => element.kind === "property")
      .sort((a, b) => orderOf(a) - orderOf(b));
  }, [shapesGraph, dataGraph, scoresGraph, widgets, activeRootShape, placeholderFocusNode]);

  // Prunes filterShape.store down to the intersection whenever the user switches the active root
  // shape (TypeSelector): a constraint whose path belonged only to the previously selected type -
  // and isn't one of the newly selected type's own properties - is stale (its property no longer
  // renders here) and must not silently keep riding along in what index.tsx eventually submits.
  // Keyed on activeRootShape's own identity, not `properties`, so a re-score/widget-registry change
  // on the *same* type never mistakes itself for a type switch and prunes nothing.
  const previousTypeRef = useRef<{ rootShape: Quad_Subject; paths: Set<string> } | null>(null);
  useEffect(() => {
    if (!activeRootShape) return;
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
  }, [activeRootShape, properties, filterShape]);

  const instances = useMemo(
    () =>
      activeRootShape
        ? (targetsOfShape(activeRootShape, shapesGraph, dataGraph) as Quad_Subject[])
        : [],
    [activeRootShape, shapesGraph, dataGraph],
  );

  if (!activeRootShape) return null;

  return (
    <div className="st-facet-node-ui-component">
      {rootShapes.length > 1 && (
        <TypeSelector
          rootShapes={rootShapes}
          classFor={(rootShape) => classFor(rootShape, shapesGraph)}
          dataGraph={dataGraph}
          scoresGraph={scoresGraph}
          widgets={widgets}
          filterShape={filterShape}
          selectedRootShape={activeRootShape}
          onSelectRootShape={setSelectedRootShape}
        />
      )}
      {properties.map((property, index) => (
        <FacetPropertyComponent
          key={index}
          property={property}
          filterShape={filterShape}
          instances={instances}
        />
      ))}
    </div>
  );
}
