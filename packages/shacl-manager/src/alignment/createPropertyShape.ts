import type { NamedNode, Quad } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { localName } from "@/helpers/iri.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";

/**
 * The quads for a new property shape on `nodeShape` whose sh:path is `property`: turning an
 * ontology-only row into a merged one. The IRI is minted next to the node shape's own.
 */
export function createPropertyShape(
  nodeShape: NamedNode,
  property: NamedNode,
): {
  propertyShape: NamedNode;
  additions: Quad[];
} {
  const propertyShape = factory.namedNode(
    `${nodeShape.value}-${localName(property.value) ?? encodeURIComponent(property.value)}`,
  );
  return {
    propertyShape,
    additions: [
      factory.quad(propertyShape, rdf("type"), sh("PropertyShape")),
      factory.quad(propertyShape, sh("path"), property),
      factory.quad(nodeShape, sh("property"), propertyShape),
    ],
  };
}
