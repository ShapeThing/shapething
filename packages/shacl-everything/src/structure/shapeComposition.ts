import type { NamedNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { getRdfList } from "@/helpers/rdfList.ts";
import { isDeactivated } from "@/helpers/isDeactivated.ts";
import { sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { parsePropertyPath, type PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";

export type ChoiceConnective = "or" | "xone";

export const CHOICE_CONNECTIVES: ChoiceConnective[] = ["or", "xone"];

export type ShapeComposition = {
  // Every non-deactivated sh:property shape reachable via the start shape(s) themselves plus
  // sh:and/sh:node recursion, in walk order.
  propertyShapes: NamedNode[];
  // Every node-level sh:or/sh:xone found along the same walk - `shape` is the node declaring it.
  choices: { shape: Term; connective: ChoiceConnective; list: Term }[];
};

/**
 * The shapes-graph-only half of childrenForShape (see its doc comment for the semantics): walks
 * `shapes` through sh:and/sh:node, skipping sh:deactivated shapes, collecting property shapes and
 * node-level sh:or/sh:xone lists. Kept free of PropertyUIElement/ChoiceElement so resolution/
 * (targets.ts) can reason about which paths a set of shapes declares without importing the
 * element classes - which themselves import resolution/label.ts.
 */
export function walkShapeComposition(shapesGraph: RdfStore, shapes: Term[]): ShapeComposition {
  const visited = new Set<string>();
  const result: ShapeComposition = { propertyShapes: [], choices: [] };

  function walk(current: Term): void {
    const key = termKey(current);
    if (visited.has(key)) return;
    visited.add(key);

    for (const quad of shapesGraph.getQuads(current, sh("property"))) {
      if (isDeactivated(quad.object, shapesGraph)) continue;
      result.propertyShapes.push(quad.object as NamedNode);
    }

    for (const listQuad of shapesGraph.getQuads(current, sh("and"))) {
      for (const branchShape of getRdfList(listQuad.object, shapesGraph)) {
        if (isDeactivated(branchShape, shapesGraph)) continue;
        walk(branchShape);
      }
    }

    for (const nodeQuad of shapesGraph.getQuads(current, sh("node"))) {
      if (isDeactivated(nodeQuad.object, shapesGraph)) continue;
      walk(nodeQuad.object);
    }

    for (const connective of CHOICE_CONNECTIVES) {
      for (const listQuad of shapesGraph.getQuads(current, sh(connective))) {
        result.choices.push({ shape: listQuad.subject, connective, list: listQuad.object });
      }
    }
  }

  for (const shape of shapes) walk(shape);
  return result;
}

/**
 * `propertyShapes` bucketed by canonical SPARQL path (toSparql), in first-seen order - the grouping
 * rule groupPropertyShapesByPath turns into one PropertyUIElement per bucket. A shape with no
 * parseable sh:path is dropped. `path` is the parse of each bucket's first shape.
 */
export function groupShapesByPath(
  shapesGraph: RdfStore,
  propertyShapes: NamedNode[],
): Map<string, { path: PropertyPath; shapes: NamedNode[] }> {
  const groups = new Map<string, { path: PropertyPath; shapes: NamedNode[] }>();
  for (const propertyShape of propertyShapes) {
    const path = parsePropertyPath(propertyShape, shapesGraph);
    if (!path) continue;
    const sparqlPath = toSparql(path);
    const group = groups.get(sparqlPath);
    if (group) group.shapes.push(propertyShape);
    else groups.set(sparqlPath, { path, shapes: [propertyShape] });
  }
  return groups;
}
