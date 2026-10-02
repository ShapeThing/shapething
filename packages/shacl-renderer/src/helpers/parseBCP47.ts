import type { Term } from "@rdfjs/types";
import type { BCP47 } from "@/types/BCP47.ts";

// Mirrors the shape BCP47 itself models (language[-script][-region], no variant/extension/
// private-use subtags) - Intl.getCanonicalLocales() alone would also accept those wider tags.
const SUPPORTED_BCP47_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/;

// Canonicalizes a user-typed BCP47 tag (e.g. "en-gb" -> "en-GB") and rejects anything malformed
// or outside the subset BCP47 models, returning undefined in either case. Intl.getCanonicalLocales
// throws for syntactically invalid input rather than returning one, hence the try/catch.
export function canonicalizeBCP47(input: string): BCP47 | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  let canonical: string;
  try {
    [canonical] = Intl.getCanonicalLocales(trimmed);
  } catch {
    return undefined;
  }

  return canonical && SUPPORTED_BCP47_PATTERN.test(canonical) ? (canonical as BCP47) : undefined;
}

// The language tag a term carries, in canonical casing ("nl-nl" -> "nl-NL"), or "" for a non-Literal
// or language-less one. rdf-data-factory (following RDF 1.2) lowercases every tag a Literal is
// created with, so a tag read straight off .language no longer matches the configured/shipped tags
// (contentLanguages, the .ftl locales) it's compared against or shown alongside. A tag outside the
// subset canonicalizeBCP47 accepts is passed through as-is rather than dropped.
export function literalLanguage(term: Term): BCP47 | "" {
  if (term.termType !== "Literal" || !term.language) return "";
  return canonicalizeBCP47(term.language) ?? (term.language as BCP47);
}
