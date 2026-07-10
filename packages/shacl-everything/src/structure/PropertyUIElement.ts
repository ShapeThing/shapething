import type { NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

export type PropertyUIElementOptions = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  propertyShape: NamedNode;
};

export class PropertyUIElement {
  public shapesGraph: RdfStore;
  public dataGraph: RdfStore;
  public propertyShape: NamedNode;

  constructor(options: PropertyUIElementOptions) {
    this.shapesGraph = options.shapesGraph;
    this.dataGraph = options.dataGraph;
    this.propertyShape = options.propertyShape;
  }
}
