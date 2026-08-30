import { termKey } from "@/helpers/termKey.ts";
import type { Term } from "@rdfjs/types";

export function dedupeTerms(terms: Term[]): Term[] {
  const seen = new Map<string, Term>();
  for (const term of terms) {
    if (!seen.has(termKey(term))) seen.set(termKey(term), term);
  }
  return [...seen.values()];
}
