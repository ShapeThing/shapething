import type { Literal } from "@rdfjs/types";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import type { BCP47 } from "@/types/BCP47.ts";

export default function language(terms: Literal[], languages: BCP47[] = []): Literal {
  return bestByLanguage(terms, languages) as Literal;
}
