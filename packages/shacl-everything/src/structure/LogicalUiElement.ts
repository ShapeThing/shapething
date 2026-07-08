import type { RdfStore } from "rdf-stores";
import { PropertyUIElement } from "./PropertyUIElement.ts";

/** sh:not is excluded: it is a negative constraint with no properties of its own to expose. */
export type LogicalConnective = "and" | "or" | "xone";

export class LogicalUiElement {
    public shapesGraph: RdfStore;
    public dataGraph: RdfStore;
    public connective: LogicalConnective;
    public branches: PropertyUIElement[][];

    constructor(
        shapesGraph: RdfStore,
        dataGraph: RdfStore,
        connective: LogicalConnective,
        branches: PropertyUIElement[][],
    ) {
        this.shapesGraph = shapesGraph;
        this.dataGraph = dataGraph;
        this.connective = connective;
        this.branches = branches;
    }

    /** sh:and branches all apply at once; sh:or/sh:xone require picking one branch. */
    get selectable(): boolean {
        return this.connective !== "and";
    }
}
