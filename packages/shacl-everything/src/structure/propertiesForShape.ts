import type { NamedNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { sh } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";

export function propertiesForShape(
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
  shape: Term,
  scoresGraph?: RdfStore,
): PropertyUIElement[] {
  const propertyShapeQuads = shapesGraph.getQuads(shape, sh("property"));
  const groupedPropertyShapes = new Map<string, NamedNode[]>();

  for (const propertyShapeQuad of propertyShapeQuads) {
    const path = parsePropertyPath(propertyShapeQuad.object, shapesGraph);

    if (!path) continue;
    const sparqlPath = toSparql(path);
    const propertyShapes = groupedPropertyShapes.get(sparqlPath) ?? [];
    propertyShapes.push(propertyShapeQuad.object as NamedNode);
    groupedPropertyShapes.set(sparqlPath, propertyShapes);
  }

  return [...groupedPropertyShapes.values()].map(
    (propertyShapes) =>
      new PropertyUIElement({ shapesGraph, dataGraph, scoresGraph, propertyShapes }),
  );
}
