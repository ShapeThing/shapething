import type { Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { getRdfList } from "@/helpers/rdfList.ts";
import { sh } from "@/helpers/namespaces.ts";
import { CHOICE_CONNECTIVES, ChoiceElement } from "@/structure/ChoiceElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { propertiesForShape } from "@/structure/propertiesForShape.ts";
import type { Widgets } from "@/widgets/types.ts";

/**
 * Expands `shape` (a node shape, or a shape reached via sh:and/sh:or/sh:xone/sh:node - never a
 * property shape, whose sh:node means something else entirely, see DetailsEditor) into the
 * PropertyUIElements/ChoiceElements it contributes to `focusNode`: its own sh:property, plus
 * sh:and and sh:node targets flattened in recursively (both apply unconditionally to this same
 * focus node), plus sh:or/sh:xone wrapped as a ChoiceElement. Shape graphs are assumed acyclic,
 * same as the rest of this codebase (no cycle guard).
 */
export function childrenForShape(
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
  shape: Term,
  focusNode: Quad_Subject,
  scoresGraph?: RdfStore,
  widgets?: Widgets,
): (PropertyUIElement | ChoiceElement)[] {
  const elements: (PropertyUIElement | ChoiceElement)[] = [];

  elements.push(
    ...propertiesForShape(shapesGraph, dataGraph, shape, focusNode, scoresGraph, widgets),
  );

  for (const listQuad of shapesGraph.getQuads(shape, sh("and"))) {
    for (const branchShape of getRdfList(listQuad.object, shapesGraph)) {
      elements.push(
        ...childrenForShape(shapesGraph, dataGraph, branchShape, focusNode, scoresGraph, widgets),
      );
    }
  }

  for (const nodeQuad of shapesGraph.getQuads(shape, sh("node"))) {
    elements.push(
      ...childrenForShape(shapesGraph, dataGraph, nodeQuad.object, focusNode, scoresGraph, widgets),
    );
  }

  for (const connective of CHOICE_CONNECTIVES) {
    for (const listQuad of shapesGraph.getQuads(shape, sh(connective))) {
      elements.push(
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

  return elements;
}
