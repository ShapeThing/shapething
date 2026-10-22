import type { NamedNode, Term } from "@rdfjs/types";
import { termKey } from "@/helpers/iri.ts";
import { ancestorsOf, type ClassIndex } from "@/ontology/model.ts";
import {
  targetClassesOf,
  type NodeShape,
  type NodeShapeIndex,
  type PropertyShape,
} from "./model.ts";

/** Why a property shape applies to the node shape in focus. */
export type Origin =
  | { kind: "defined" }
  // `root`: in a class view, the shape on the class whose sh:node chain reached `via`.
  | { kind: "node"; via: Term; root?: Term }
  | { kind: "inherited"; owlClass: NamedNode; shape: Term };

export type ResolvedPropertyShape = { propertyShape: PropertyShape; origin: Origin };

export type ShapeGraph = {
  nodeShapes: NodeShapeIndex;
  propertyShapes: Map<string, PropertyShape[]>;
  nodeReferences: Map<string, Term[]>;
  shapesByClass: Map<string, NodeShape[]>;
  classes: ClassIndex;
};

/** `shape` plus everything it reaches through sh:node, breadth first. Cycle safe. */
function withNodeReferences(shape: Term, graph: ShapeGraph): Term[] {
  const result: Term[] = [shape];
  const seen = new Set([termKey(shape)]);
  for (let i = 0; i < result.length; i++) {
    for (const node of graph.nodeReferences.get(termKey(result[i])) ?? []) {
      if (seen.has(termKey(node))) continue;
      seen.add(termKey(node));
      result.push(node);
    }
  }
  return result;
}

/**
 * Every property shape that applies to focus nodes of `shape`, each listed once with the most
 * specific reason: defined on the shape itself, then reached via sh:node, then inherited from
 * shapes targeting a superclass (SHACL class targets include instances of subclasses).
 */
export function resolveProperties(shape: NodeShape, graph: ShapeGraph): ResolvedPropertyShape[] {
  const result: ResolvedPropertyShape[] = [];
  const seen = new Set<string>();

  const add = (owner: Term, origin: Origin) => {
    for (const propertyShape of graph.propertyShapes.get(termKey(owner)) ?? []) {
      if (seen.has(propertyShape.key)) continue;
      seen.add(propertyShape.key);
      result.push({ propertyShape, origin });
    }
  };

  const [self, ...viaNode] = withNodeReferences(shape.term, graph);
  add(self, { kind: "defined" });
  for (const via of viaNode) add(via, { kind: "node", via });

  const visitedShapes = new Set([shape.key]);
  for (const owlClass of targetClassesOf(shape)) {
    for (const ancestor of ancestorsOf(graph.classes, owlClass.value)) {
      const ancestorClass = graph.classes.get(ancestor)!.term;
      for (const ancestorShape of graph.shapesByClass.get(ancestor) ?? []) {
        if (visitedShapes.has(ancestorShape.key)) continue;
        visitedShapes.add(ancestorShape.key);
        for (const owner of withNodeReferences(ancestorShape.term, graph)) {
          add(owner, { kind: "inherited", owlClass: ancestorClass, shape: ancestorShape.term });
        }
      }
    }
  }

  return result;
}
