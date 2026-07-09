import type { NamedNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { getRdfList } from "../../helpers/rdfList.ts";
import { rdf, sh } from "../../helpers/namespaces.ts";

export type PropertyPath =
  | { type: "predicate"; predicate: NamedNode }
  | { type: "sequence"; items: PropertyPath[] }
  | { type: "alternative"; items: PropertyPath[] }
  | { type: "inverse"; path: PropertyPath }
  | { type: "zeroOrMore"; path: PropertyPath }
  | { type: "oneOrMore"; path: PropertyPath }
  | { type: "zeroOrOne"; path: PropertyPath };

export function parsePropertyPath(propertyShape: Term, shapesGraph: RdfStore): PropertyPath | null {
  const pathQuads = shapesGraph.getQuads(propertyShape, sh("path"));
  if (pathQuads.length === 0) {
    return null;
  }

  return parsePathNode(pathQuads[0].object, shapesGraph);
}

function parsePathNode(pathNode: Term, shapesGraph: RdfStore): PropertyPath {
  if (pathNode.termType === "Literal") {
    throw new Error(
      `Invalid path node: ${pathNode.value} is a literal, expected a NamedNode or BlankNode`,
    );
  }

  // 4.1 Predicate Paths
  if (pathNode.termType === "NamedNode") {
    return { type: "predicate", predicate: pathNode };
  }

  // 4.3 Alternative Paths
  const alternativePathQuads = shapesGraph.getQuads(pathNode, sh("alternativePath"));
  if (alternativePathQuads.length > 0) {
    const items = getRdfList(alternativePathQuads[0].object, shapesGraph).map((item) =>
      parsePathNode(item, shapesGraph),
    );
    return { type: "alternative", items };
  }

  // 4.4 Inverse Paths
  const inversePathQuads = shapesGraph.getQuads(pathNode, sh("inversePath"));
  if (inversePathQuads.length > 0) {
    return {
      type: "inverse",
      path: parsePathNode(inversePathQuads[0].object, shapesGraph),
    };
  }

  // 4.5 Zero-Or-More Paths
  const zeroOrMorePathQuads = shapesGraph.getQuads(pathNode, sh("zeroOrMorePath"));
  if (zeroOrMorePathQuads.length > 0) {
    return {
      type: "zeroOrMore",
      path: parsePathNode(zeroOrMorePathQuads[0].object, shapesGraph),
    };
  }

  // 4.6 One-Or-More Paths
  const oneOrMorePathQuads = shapesGraph.getQuads(pathNode, sh("oneOrMorePath"));
  if (oneOrMorePathQuads.length > 0) {
    return {
      type: "oneOrMore",
      path: parsePathNode(oneOrMorePathQuads[0].object, shapesGraph),
    };
  }

  // 4.7 Zero-Or-One Paths
  const zeroOrOnePathQuads = shapesGraph.getQuads(pathNode, sh("zeroOrOnePath"));
  if (zeroOrOnePathQuads.length > 0) {
    return {
      type: "zeroOrOne",
      path: parsePathNode(zeroOrOnePathQuads[0].object, shapesGraph),
    };
  }

  // 4.2 Sequence Paths
  if (shapesGraph.getQuads(pathNode, rdf("first")).length > 0) {
    const items = getRdfList(pathNode, shapesGraph).map((item) => parsePathNode(item, shapesGraph));
    return { type: "sequence", items };
  }

  throw new Error(`Unsupported path node type: ${pathNode.termType}`);
}
