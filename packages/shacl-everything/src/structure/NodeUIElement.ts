import type { NamedNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { getRdfList } from "../helpers/rdfList.ts";
import { sh } from "../helpers/namespaces.ts";
import {
    LogicalUiElement,
    type LogicalConnective,
} from "./LogicalUiElement.ts";
import { PropertyUIElement } from "./PropertyUIElement.ts";
import { parsePropertyPath } from "./paths/parsePropertyPath.ts";
import { toSparql } from "./paths/toSparql.ts";

export interface NodeUIElementOptions {
    shapesGraph: RdfStore;
    dataGraph: RdfStore;
    focusNode: NamedNode;
    nodeShapes: NamedNode[];
}

const LOGICAL_CONNECTIVES: LogicalConnective[] = ["and", "or", "xone"];

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

    propertyUiElements(): (PropertyUIElement | LogicalUiElement)[] {
        const elements: (PropertyUIElement | LogicalUiElement)[] = [];
        for (const nodeShape of this.nodeShapes) {
            elements.push(...this.propertiesForShape(nodeShape));

            for (const connective of LOGICAL_CONNECTIVES) {
                const listQuads = this.shapesGraph.getQuads(
                    nodeShape,
                    sh(connective),
                );

                for (const listQuad of listQuads) {
                    const branches = getRdfList(
                        listQuad.object,
                        this.shapesGraph,
                    ).map((branchShape) => this.propertiesForShape(branchShape));

                    elements.push(
                        new LogicalUiElement(
                            this.shapesGraph,
                            this.dataGraph,
                            connective,
                            branches,
                        ),
                    );
                }
            }
        }
        return elements;
    }

    private propertiesForShape(shape: Term): PropertyUIElement[] {
        const propertyShapes = this.shapesGraph.getQuads(shape, sh("property"));
        const groupedPropertyShapes = new Map<string, PropertyUIElement>();

        for (const propertyShape of propertyShapes) {
            const path = parsePropertyPath(
                propertyShape.object,
                this.shapesGraph,
            );

            if (!path) continue;
            const sparqlPath = toSparql(path);
            groupedPropertyShapes.set(
                sparqlPath,
                new PropertyUIElement(
                    this.shapesGraph,
                    this.dataGraph,
                    propertyShape.object as NamedNode,
                ),
            );
        }

        return [...groupedPropertyShapes.values()];
    }
}
