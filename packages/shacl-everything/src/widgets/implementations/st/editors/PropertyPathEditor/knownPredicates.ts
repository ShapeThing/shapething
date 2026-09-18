import type { NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

// Every distinct predicate actually used (in predicate position) across `graphs`, deduped by IRI -
// the candidate list PathItemModal's predicate field offers as autocomplete suggestions. Free-text
// entry always works regardless of whether it matches one of these.
export function knownPredicates(...graphs: RdfStore[]): NamedNode[] {
  const seen = new Map<string, NamedNode>();
  for (const graph of graphs) {
    for (const quad of graph.getQuads()) {
      if (quad.predicate.termType === "NamedNode" && !seen.has(quad.predicate.value)) {
        seen.set(quad.predicate.value, quad.predicate);
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.value.localeCompare(b.value));
}
