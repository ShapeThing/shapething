import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { sh } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import type { Widgets } from "@/widgets/types.ts";

/**
 * Groups `propertyShapes` (sh:PropertyShape terms, typically gathered from more than one node
 * shape applicable to the same focus node) by their canonical SPARQL path into one
 * PropertyUIElement per unique path - SHACL treats co-path property shapes as conjunctive
 * constraints on one logical property regardless of which shape declared them, and
 * PropertyUIElement's own constraint resolution (constraintResolutions.ts) already merges across
 * whatever shapes end up in its `propertyShapes` array, so this is the one place that decides
 * which property shapes belong together.
 */
export function groupPropertyShapesByPath(
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
  propertyShapes: NamedNode[],
  focusNode: Quad_Subject,
  scoresGraph?: RdfStore,
  widgets?: Widgets,
): PropertyUIElement[] {
  const groupedPropertyShapes = new Map<string, NamedNode[]>();

  for (const propertyShape of propertyShapes) {
    const path = parsePropertyPath(propertyShape, shapesGraph);

    if (!path) continue;
    const sparqlPath = toSparql(path);
    const shapes = groupedPropertyShapes.get(sparqlPath) ?? [];
    shapes.push(propertyShape);
    groupedPropertyShapes.set(sparqlPath, shapes);
  }

  return [...groupedPropertyShapes.values()].map(
    (shapes) =>
      new PropertyUIElement({
        shapesGraph,
        dataGraph,
        scoresGraph,
        widgetRegistry: widgets,
        focusNode,
        propertyShapes: shapes,
      }),
  );
}

/** `groupPropertyShapesByPath` scoped to one shape's own directly-declared sh:property list. */
export function propertiesForShape(
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
  shape: Term,
  focusNode: Quad_Subject,
  scoresGraph?: RdfStore,
  widgets?: Widgets,
): PropertyUIElement[] {
  const propertyShapeQuads = shapesGraph.getQuads(shape, sh("property"));
  return groupPropertyShapesByPath(
    shapesGraph,
    dataGraph,
    propertyShapeQuads.map((quad) => quad.object as NamedNode),
    focusNode,
    scoresGraph,
    widgets,
  );
}
