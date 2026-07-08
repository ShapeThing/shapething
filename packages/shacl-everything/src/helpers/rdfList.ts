import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdf } from "./namespaces.ts";

export function getRdfList(listNode: Term, store: RdfStore): Term[] {
    const items: Term[] = [];
    let current = listNode;

    while (
        current.termType === "BlankNode" || current.termType === "NamedNode"
    ) {
        if (current.value === rdf("nil").value) {
            break;
        }

        const firstQuad = store.getQuads(current, rdf("first"))[0];
        if (!firstQuad) {
            break;
        }
        items.push(firstQuad.object);

        const restQuad = store.getQuads(current, rdf("rest"))[0];
        if (!restQuad) {
            break;
        }
        current = restQuad.object;
    }

    return items;
}
