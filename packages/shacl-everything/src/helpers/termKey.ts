import type { Term } from "@rdfjs/types";

/** A string uniquely identifying a term's value - for dedup maps and cache/query keys. */
export function termKey(term: Term): string {
  if (term.termType === "Literal") {
    return `Literal|${term.value}|${term.datatype.value}|${term.language}`;
  }
  return `${term.termType}|${term.value}`;
}
