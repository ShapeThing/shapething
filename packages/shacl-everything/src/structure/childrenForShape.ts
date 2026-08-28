import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { getRdfList } from "@/helpers/rdfList.ts";
import { termKey } from "@/helpers/termKey.ts";
import { sh } from "@/helpers/namespaces.ts";
import { CHOICE_CONNECTIVES, ChoiceElement } from "@/structure/ChoiceElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { groupPropertyShapesByPath } from "@/structure/propertiesForShape.ts";
import type { Widgets } from "@/widgets/types.ts";

/**
 * Expands `shape` (one node shape, or several - e.g. NodeUIElement.children() passing its whole
 * nodeShapes list at once - or a shape reached via sh:and/sh:node - never a property shape, whose
 * sh:node means something else entirely, see DetailsEditor) into the PropertyUIElements/
 * ChoiceElements it contributes to `focusNode`.
 *
 * All sh:property shapes reachable via `shape` itself plus sh:and/sh:node recursion (across every
 * shape passed in, when given an array) are collected into ONE flat list first, then grouped by
 * canonical SPARQL path (groupPropertyShapesByPath) into a single PropertyUIElement per path -
 * SHACL treats co-path property shapes as conjunctive constraints on one logical property, and
 * that holds regardless of which applicable shape happens to declare a given path, not just
 * within one shape's own sh:property list. A `visited` set (keyed by termKey) guards the walk
 * against processing the same shape's contents twice - both as a cycle guard (shape graphs are
 * assumed acyclic, but nothing upstream actually enforces that) and so a shape reachable two ways
 * (e.g. listed directly in nodeShapes AND pulled in via another listed shape's sh:node) doesn't
 * contribute duplicate property-shape entries into the merge.
 *
 * sh:or/sh:xone are wrapped as a ChoiceElement instead of being folded into the path merge - each
 * branch is an alternative, not a conjunction, so ChoiceElement.children() deliberately starts
 * every branch with its own independent walk rather than sharing state with the outer one.
 */
export function childrenForShape(
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
  shape: Term | Term[],
  focusNode: Quad_Subject,
  scoresGraph?: RdfStore,
  widgets?: Widgets,
): (PropertyUIElement | ChoiceElement)[] {
  const visited = new Set<string>();
  const propertyShapes: NamedNode[] = [];
  const choiceElements: ChoiceElement[] = [];

  function walk(current: Term): void {
    const key = termKey(current);
    if (visited.has(key)) return;
    visited.add(key);

    for (const quad of shapesGraph.getQuads(current, sh("property"))) {
      propertyShapes.push(quad.object as NamedNode);
    }

    for (const listQuad of shapesGraph.getQuads(current, sh("and"))) {
      for (const branchShape of getRdfList(listQuad.object, shapesGraph)) {
        walk(branchShape);
      }
    }

    for (const nodeQuad of shapesGraph.getQuads(current, sh("node"))) {
      walk(nodeQuad.object);
    }

    for (const connective of CHOICE_CONNECTIVES) {
      for (const listQuad of shapesGraph.getQuads(current, sh(connective))) {
        choiceElements.push(
          new ChoiceElement(
            shapesGraph,
            dataGraph,
            focusNode,
            listQuad.subject,
            connective,
            listQuad.object,
            scoresGraph,
            widgets,
          ),
        );
      }
    }
  }

  for (const startShape of Array.isArray(shape) ? shape : [shape]) {
    walk(startShape);
  }

  return [
    ...groupPropertyShapesByPath(
      shapesGraph,
      dataGraph,
      propertyShapes,
      focusNode,
      scoresGraph,
      widgets,
    ),
    ...choiceElements,
  ];
}
