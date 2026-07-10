import type { NamedNode } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { ex } from "@/helpers/namespaces.ts";
import type { BCP47 } from "@/types/BCP47.ts";

export type Environment = {
    shapesGraph: RdfStore;
    dataGraph: RdfStore;
    scoresGraph: RdfStore;
    focusNode: NamedNode;
    nodeShapes: NamedNode[];
    mode: "edit" | "view" | "facet";
    interfaceLanguage: BCP47;
    contentLanguage: BCP47;
};

export const defaultEnvironment: Environment = {
    shapesGraph: RdfStore.createDefault(),
    dataGraph: RdfStore.createDefault(),
    scoresGraph: RdfStore.createDefault(),
    focusNode: ex("focusNode"),
    nodeShapes: [],
    mode: "edit",
    interfaceLanguage: "en-GB",
    contentLanguage: "en-GB",
};
