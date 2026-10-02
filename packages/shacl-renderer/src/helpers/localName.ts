import type { Term } from "@rdfjs/types";

export function localName(term?: Term): string | null {
  if (!term) return null;
  if (term.termType === "BlankNode") return null;

  const hashIndex = term.value.lastIndexOf("#");
  if (hashIndex !== -1) return term.value.slice(hashIndex + 1);
  return term.value.slice(term.value.lastIndexOf("/") + 1);
}
