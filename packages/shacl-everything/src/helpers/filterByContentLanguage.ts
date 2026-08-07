import type { Term } from "@rdfjs/types";
import { primarySubtag } from "@/helpers/bestByLanguage.ts";
import type { BCP47 } from "@/types/BCP47.ts";

/**
 * Narrows a multi-valued property's terms down to the ones relevant while `activeLanguage` is
 * being viewed/edited: a language-tagged Literal is kept only if it matches (exactly or by
 * primary subtag), everything else - non-Literals, and Literals with no language tag at all -
 * always passes through untouched.
 */
export function filterByContentLanguage(terms: Term[], activeLanguage: BCP47): Term[] {
  return terms.filter((term) => {
    if (term.termType !== "Literal" || !term.language) return true;
    return (
      term.language.toLowerCase() === activeLanguage.toLowerCase() ||
      primarySubtag(term.language) === primarySubtag(activeLanguage)
    );
  });
}
