import type { Literal, Term } from "@rdfjs/types";
import type { BCP47 } from "@/types/BCP47.ts";

const primarySubtag = (language: string) => language.split("-")[0].toLowerCase();

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
