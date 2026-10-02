import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdf } from "@/helpers/namespaces.ts";
import { getRdfList } from "@/helpers/rdfList.ts";

// sh:in/sh:languageIn/sh:ignoredProperties/sh:uniqueValuesFor/sh:nodeKind/sh:datatype may point at
// either a plain term or the head of an rdf:List. Both forms need to resolve to "the values this
// constraint is actually about" before they can be merged.
export function expandListOrTerm(term: Term, shapesGraph: RdfStore): Term[] {
  if (term.termType !== "BlankNode" && term.termType !== "NamedNode") {
    return [term];
  }
  if (term.equals(rdf("nil"))) return [];
  if (shapesGraph.getQuads(term, rdf("first")).length === 0) return [term];
  return getRdfList(term, shapesGraph);
}
