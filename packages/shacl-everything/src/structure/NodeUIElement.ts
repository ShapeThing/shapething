import type { Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

export type NodeUIElementOptions = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph?: RdfStore;
  focusNode: Quad_Subject;
  nodeShapes: Quad_Subject[];
};

export class NodeUIElement {
  public shapesGraph: RdfStore;
  public dataGraph: RdfStore;
  public scoresGraph: RdfStore;
  public focusNode: Quad_Subject;
  public nodeShapes: Quad_Subject[];

  constructor(options: NodeUIElementOptions) {
    this.shapesGraph = options.shapesGraph;
    this.dataGraph = options.dataGraph;
    this.scoresGraph = options.scoresGraph ?? RdfStore.createDefault();
    this.focusNode = options.focusNode;
    this.nodeShapes = options.nodeShapes;
  }

  children(): (PropertyUIElement | ChoiceElement)[] {
    return this.nodeShapes.flatMap((nodeShape) =>
      childrenForShape(
        this.shapesGraph,
        this.dataGraph,
        nodeShape,
        this.focusNode,
        this.scoresGraph,
      ),
    );
  }
}
