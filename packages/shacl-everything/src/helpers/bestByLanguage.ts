import type { Literal, Term } from "@rdfjs/types";
import type { BCP47 } from "@/types/BCP47.ts";

const primarySubtag = (language: string) => language.split("-")[0].toLowerCase();

// BCP47 "lookup" negotiation: an exact tag match wins, then a shared primary subtag (nl-NL asked
// for, nl-BE offered), then a value with no language tag at all (e.g. an IRI or a plain literal),
// and only if none of those exist does it fall back to whatever came first so a value is never
// dropped purely because it is in the wrong language. Ties within a tier keep `values`' order.
export function bestByLanguage(values: Term[], languages: BCP47[]): Term | undefined {
  if (values.length === 0) return undefined;

  const hasLanguageTag = (term: Term): term is Literal =>
    term.termType === "Literal" && term.language !== "";

  if (!values.some(hasLanguageTag)) return values[0];

  for (const language of languages) {
    const exact = values.find(
      (term) => hasLanguageTag(term) && term.language.toLowerCase() === language.toLowerCase(),
    );
    if (exact) return exact;
  }

  for (const language of languages) {
    const primary = primarySubtag(language);
    const match = values.find(
      (term) => hasLanguageTag(term) && primarySubtag(term.language) === primary,
    );
    if (match) return match;
  }

  return values.find((term) => !hasLanguageTag(term)) ?? values[0];
}
