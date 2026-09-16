import type { NamedNode } from "@rdfjs/types";
import { prefixes } from "@/helpers/namespaces.ts";

// Longest namespace base first, so a term matching more than one known prefix's base (none of
// today's actually overlap, but nothing guarantees that of a future addition) resolves to its
// most specific prefix rather than whichever shorter one happens to iterate first.
const sortedPrefixes = Object.entries(prefixes).sort(([, a], [, b]) => b.length - a.length);

/**
 * The `prefix:localName` form of `term`, using this codebase's own known vocabulary prefixes
 * (helpers/namespaces.ts's `prefixes`) - undefined when no known prefix's namespace matches (or
 * matches with nothing left over for a local name), so a caller can fall back to the raw IRI or
 * local name instead of inventing a wrong prefix.
 */
export function prefixedIri(term: NamedNode): string | undefined {
  const match = sortedPrefixes.find(([, base]) => term.value.startsWith(base));
  if (!match) return undefined;

  const [alias, base] = match;
  const localName = term.value.slice(base.length);
  return localName ? `${alias}:${localName}` : undefined;
}
