import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { sh } from "@/helpers/namespaces.ts";
import { getLanguagePreference } from "@/resolution/globalConfiguration.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { BCP47, LanguageRange } from "@/types/BCP47.ts";

// Generic over T so a caller picking among Literals gets a Literal back, while a caller picking
// among arbitrary Terms (e.g. valueNodeClassification's IRI-or-literal candidates - a non-Literal
// term is simply "languageless", see bestByLanguage) gets the same term type it passed in.
export default function language<T extends Term>(terms: T[], languages: LanguageRange[] = []): T {
  return bestByLanguage(terms, languages) as T;
}

/**
 * 8.1 Language Resolution's priority order for CHROME - a property's own label (sh:name) or a
 * constraint branch's label - as a single ranked list ready for bestByLanguage/language(): the
 * caller-supplied `languages` (e.g. [activeInterfaceLanguage] - the "live UI selection" sub-option
 * of rule 2), then the shui:Configuration global shui:languagePreference (the "global configuration"
 * sub-option of rule 2, as additional fallback ranks). Browser Accept-Language (rule 3) is out of
 * scope. Deliberately excludes sh:languageIn (rule 1): that constrains which languages a property's
 * own rdf:langString *value* may be in, not which language its label renders in - the two are
 * independent axes (content language vs. interface language), and chrome must stay driven by the
 * latter alone. See effectiveLanguages for the value-resolution counterpart that does include it.
 */
export function configuredLanguages(
  shapesGraph: RdfStore,
  languages: BCP47[] = [],
): LanguageRange[] {
  return [...languages, ...getLanguagePreference(shapesGraph)];
}

/**
 * 8.1 Language Resolution's priority order for a VALUE node's own label (valueNodeLabel/
 * valueNodeClassification): 1) sh:languageIn declared on `propertyShape` (already cross-shape-intersected
 * via PropertyUIElement.get()'s keepListIntersection resolution), 2) the caller-supplied `languages`,
 * 3) shui:languagePreference. Unlike configuredLanguages, sh:languageIn is included here - it's
 * exactly the axis that governs which language of this property's own content is preferred.
 */
export function effectiveLanguages(
  propertyShape: PropertyUIElement,
  languages: BCP47[] = [],
): LanguageRange[] {
  const languageIn = propertyShape.get(sh("languageIn")).map((term) => term.value as BCP47);
  return [...languageIn, ...configuredLanguages(propertyShape.shapesGraph, languages)];
}
