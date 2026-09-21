import type { NamedNode } from "@rdfjs/types";
import { prefixes } from "@/helpers/namespaces.ts";

/**
 * The `prefix:localName` form of `term`, preferring a document's own alias for a namespace (
 * `sourcePrefixes` - typically Environment.sourcePrefixes, gathered while parsing the actual
 * shapes/data RDF source - see preprocess/resolveRdfSources.ts) over this codebase's own
 * hardcoded vocabulary list (helpers/namespaces.ts's `prefixes`) whenever both declare the very
 * same base namespace - so a document that writes its own `@prefix schema1: <http://schema.org/>`
 * is echoed back using *that* alias, not this codebase's unrelated `schema:` guess. Keyed by
 * namespace base (not alias) while merging, so a `sourcePrefixes` entry re-using a common alias
 * name for an entirely different namespace (e.g. its own `ex:`) doesn't clobber this codebase's
 * unrelated `ex:` entry - the two simply coexist as separate base->alias pairs, and whichever
 * base actually matches `term` wins regardless of alias-name collisions between them. Undefined
 * when no known prefix's namespace matches (or matches with nothing left over for a local name),
 * so a caller can fall back to the raw IRI or local name instead of inventing a wrong prefix.
 */
export function prefixedIri(
  term: NamedNode,
  sourcePrefixes?: Record<string, string>,
): string | undefined {
  const aliasByBase = new Map<string, string>();
  for (const [alias, base] of Object.entries(prefixes)) aliasByBase.set(base, alias);
  for (const [alias, base] of Object.entries(sourcePrefixes ?? {})) aliasByBase.set(base, alias);

  // Longest namespace base first, so a term matching more than one known prefix's base resolves
  // to its most specific prefix rather than whichever shorter one happens to iterate first.
  const sortedPrefixes = [...aliasByBase.entries()].sort(([a], [b]) => b.length - a.length);
  const match = sortedPrefixes.find(([base]) => term.value.startsWith(base));
  if (!match) return undefined;

  const [base, alias] = match;
  const localName = term.value.slice(base.length);
  return localName ? `${alias}:${localName}` : undefined;
}
