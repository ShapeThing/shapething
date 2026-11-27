import type { NamedNode, Quad, Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { factory } from "@/helpers/factory.ts";
import { rdf, rdfs, sh } from "@/helpers/namespaces.ts";
import type { NodeUIElement } from "@/structure/NodeUIElement.ts";

/**
 * The class a new resource made through `shape` is an instance of: the shape's one class target,
 * either its sh:targetClass (3.1.3.2) or the shape itself when it is also a class (3.1.3.3, an
 * implicit class target: an rdfs:Class or a sh:ShapeClass). Undefined when the shape targets no
 * class, or more than one: the shape then doesn't say which of them a new resource is.
 */
export function targetClassOf(shape: Quad_Subject, shapesGraph: RdfStore): NamedNode | undefined {
  const classes = shapesGraph
    .getQuads(shape, sh("targetClass"), null)
    .map((quad) => quad.object)
    .filter((term): term is NamedNode => term.termType === "NamedNode");

  const isClass =
    shapesGraph.getQuads(shape, rdf("type"), rdfs("Class")).length > 0 ||
    shapesGraph.getQuads(shape, rdf("type"), sh("ShapeClass")).length > 0;
  if (isClass && shape.termType === "NamedNode") classes.push(shape);

  const distinct = dedupeTerms(classes) as NamedNode[];
  return distinct.length === 1 ? distinct[0] : undefined;
}

/**
 * Writes an rdf:type for the class target of each of `node`'s node shapes (see targetClassOf) into
 * its dataGraph, so a resource that's only just being created is an instance of the class its
 * shape targets - and so is found by that shape again once saved. Like seedDefaultValues, only
 * meant for a new resource, and returns the quads it added.
 */
export function seedTargetClassTypes(node: NodeUIElement): Quad[] {
  const classes = dedupeTerms(
    node.nodeShapes
      .map((shape) => targetClassOf(shape, node.shapesGraph))
      .filter((term): term is NamedNode => term !== undefined),
  ) as NamedNode[];

  const added: Quad[] = [];
  for (const classTerm of classes) {
    const quad = factory.quad(node.focusNode, rdf("type"), classTerm);
    if (node.dataGraph.countQuads(quad.subject, quad.predicate, quad.object, quad.graph) > 0) {
      continue;
    }
    node.dataGraph.addQuad(quad);
    added.push(quad);
  }
  return added;
}
