import type { NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

export class PropertyUIElement {
    public shapesGraph: RdfStore;
    public dataGraph: RdfStore;
    public propertyShape: NamedNode;

    constructor(
        shapesGraph: RdfStore,
        dataGraph: RdfStore,
        propertyShape: NamedNode,
    ) {
        this.shapesGraph = shapesGraph;
        this.dataGraph = dataGraph;
        this.propertyShape = propertyShape;
    }
}
