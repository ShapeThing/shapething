import type { NamedNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

// Every distinct IRI actually used anywhere (subject, predicate, or object position) across
// `graphs`, deduped by IRI - the candidate list IRIEditor's autocomplete offers for "already used
// somewhere in this shape's own shapes+data graphs". Free-text entry always works regardless of
// whether it matches one of these. Unlike knownPredicates.ts (predicate position only, for
// PathItemModal's narrower "known predicate" use case), a generic IRI-valued field has no fixed
// position to scope by.
export function knownIris(...graphs: RdfStore[]): NamedNode[] {
  const seen = new Map<string, NamedNode>();
  const record = (term: Term) => {
    if (term.termType === "NamedNode" && !seen.has(term.value)) {
      seen.set(term.value, term);
    }
  };
  for (const graph of graphs) {
    for (const quad of graph.getQuads()) {
      record(quad.subject);
      record(quad.predicate);
      record(quad.object);
    }
  }
  return [...seen.values()].sort((a, b) => a.value.localeCompare(b.value));
}
