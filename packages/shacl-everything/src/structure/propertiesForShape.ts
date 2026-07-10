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
): PropertyUIElement[] {
  const propertyShapes = shapesGraph.getQuads(shape, sh("property"));
  const groupedPropertyShapes = new Map<string, PropertyUIElement>();

  for (const propertyShape of propertyShapes) {
    const path = parsePropertyPath(propertyShape.object, shapesGraph);

    if (!path) continue;
    const sparqlPath = toSparql(path);
    groupedPropertyShapes.set(
      sparqlPath,
      new PropertyUIElement({
        shapesGraph,
        dataGraph,
        propertyShape: propertyShape.object as NamedNode,
      }),
    );
  }

  return [...groupedPropertyShapes.values()];
}
