import type { NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { getRdfList } from "../helpers/rdfList.ts";
import { sh } from "../helpers/namespaces.ts";
import { CHOICE_CONNECTIVES, ChoiceElement } from "./ChoiceElement.ts";
import { PropertyUIElement } from "./PropertyUIElement.ts";
import { propertiesForShape } from "./propertiesForShape.ts";

export interface NodeUIElementOptions {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  focusNode: NamedNode;
  nodeShapes: NamedNode[];
}

export class NodeUIElement {
  public shapesGraph: RdfStore;
  public dataGraph: RdfStore;
  public focusNode: NamedNode;
  public nodeShapes: NamedNode[];

  constructor(options: NodeUIElementOptions) {
    this.shapesGraph = options.shapesGraph;
    this.dataGraph = options.dataGraph;
    this.focusNode = options.focusNode;
    this.nodeShapes = options.nodeShapes;
  }

  children(): (PropertyUIElement | ChoiceElement)[] {
    const elements: (PropertyUIElement | ChoiceElement)[] = [];
    for (const nodeShape of this.nodeShapes) {
      elements.push(...propertiesForShape(this.shapesGraph, this.dataGraph, nodeShape));

      // sh:and applies all branches unconditionally, so its properties
      // are flattened in as if they were declared on the node shape.
      for (const listQuad of this.shapesGraph.getQuads(nodeShape, sh("and"))) {
        for (const branchShape of getRdfList(listQuad.object, this.shapesGraph)) {
          elements.push(...propertiesForShape(this.shapesGraph, this.dataGraph, branchShape));
        }
      }

      for (const connective of CHOICE_CONNECTIVES) {
        const listQuads = this.shapesGraph.getQuads(nodeShape, sh(connective));

        for (const listQuad of listQuads) {
          elements.push(
            new ChoiceElement(
              this.shapesGraph,
              this.dataGraph,
              listQuad.subject,
              connective,
              listQuad.object,
            ),
          );
        }
      }
    }
    return elements;
  }
}
