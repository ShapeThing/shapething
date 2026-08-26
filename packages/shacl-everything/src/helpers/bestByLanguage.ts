import type { Literal, Term } from "@rdfjs/types";
import type { LanguageRange } from "@/types/BCP47.ts";

export const primarySubtag = (language: string): string => language.split("-")[0].toLowerCase();

// A term with no language concept at all (non-Literal) or an explicitly language-less literal
// (Literal.language === "") - what an "" preference entry matches (spec 3.4/8.1), and also the
// final fallback when nothing in `languages` matches at any rank.
const isLanguageless = (term: Term): boolean => term.termType !== "Literal" || term.language === "";

// RFC4647 §3.3.1 Basic Filtering, extended symmetrically: `range` matches `tag` when they're equal,
// or either is a prefix of the other immediately followed by "-" (case-insensitively) - e.g. range
// "en" matches tag "en-US" (the spec's own cited example), and range "en-US" also matches tag "en"
// (most translated content only ever carries a plain language tag, while a live preference - e.g.
// from a browser locale - often carries a region; treating a broader available tag as a match for a
// more specific preference is the only way most real content ever matches at all). Two tags that
// merely share a region-qualified prefix in neither direction - e.g. "en-GB" and "en-US" - still do
// not match; only a genuine prefix relationship counts.
function matchesRange(tag: string, range: string): boolean {
  const t = tag.toLowerCase();
  const r = range.toLowerCase();
  return t === r || t.startsWith(`${r}-`) || r.startsWith(`${t}-`);
}

// 8.1 Language Resolution: `languages` is a single ranked list (already merged from sh:languageIn,
// the caller's own selection, and shui:languagePreference, in that priority order by the caller) -
// walked strictly in order, so an earlier-ranked preference with no match at all still loses to
// nothing rather than falling through to a later-ranked preference's match on a different value.
export function bestByLanguage(values: Term[], languages: LanguageRange[]): Term | undefined {
  if (values.length === 0) return undefined;

  for (const preference of languages) {
    const match =
      preference === ""
        ? values.find(isLanguageless)
        : values.find(
            (term): term is Literal =>
              term.termType === "Literal" &&
              term.language !== "" &&
              matchesRange(term.language, preference),
          );
    if (match) return match;
  }

  return values.find(isLanguageless) ?? values[0];
}
