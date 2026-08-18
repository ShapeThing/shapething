import type { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import { sh } from "@/helpers/namespaces.ts";
import { mergeLocaleLoaders } from "@/l10n/locales.ts";
import { primarySubtag } from "@/helpers/bestByLanguage.ts";

// Every distinct rdf:langString language tag actually used in `store`, in first-seen order.
// With `predicates`, only quads whose predicate is in that set are considered - used to restrict
// the scan to just sh:name/sh:description (label languages) rather than every literal.
function usedLanguages(store: RdfStore, predicates?: Set<string>): BCP47[] {
  const seen = new Set<string>();
  const languages: BCP47[] = [];

  for (const quad of store.getQuads()) {
    if (predicates && !predicates.has(quad.predicate.value)) continue;
    const object = quad.object;
    if (object.termType === "Literal" && object.language) {
      const key = object.language.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        languages.push(object.language as BCP47);
      }
    }
  }

  return languages;
}

const LABEL_PREDICATES = new Set([sh("name").value, sh("description").value]);

// Runs after resolveRdfSources, so shapesGraph/dataGraph are always resolved RdfStores here even
// though RawEnvironment's type still allows an unresolved RdfSource.
//
// Deduped by primary subtag, same as distillInterfaceLanguages below - a configured "en-GB"
// already covers a bare "en" literal found in the graphs (filterByContentLanguage matches content
// by primary subtag too), so listing both would just give the switcher two indistinguishable
// "English" entries. The configured/earlier-found tag wins and the later bare one is dropped.
export const distillLanguages: Preprocessor = (environment) => {
  const configured = environment.languages ?? [];
  const seen = new Set(configured.map((language) => primarySubtag(language)));

  const languages = [...configured];
  for (const language of [
    ...usedLanguages(environment.shapesGraph as RdfStore),
    ...usedLanguages(environment.dataGraph as RdfStore),
  ]) {
    const key = primarySubtag(language);
    if (!seen.has(key)) {
      seen.add(key);
      languages.push(language);
    }
  }

  // Nothing configured and no rdf:langString tag found anywhere - rather than leave the content
  // language switcher/filterByContentLanguage with an empty list to work from, fall back to
  // contentLanguage itself (English by default - see defaultEnvironment).
  if (languages.length === 0) languages.push(environment.contentLanguage);

  return { ...environment, languages };
};

// Every language available for the interface (chrome) to switch to: the shipped/overridden
// Fluent locales (see l10n/locales.ts), unioned with whatever language sh:name/sh:description
// happen to be authored in across the shapes graph - so e.g. a form whose property shapes carry
// Frisian sh:name literals can be switched to even without a Frisian .ftl bundle (chrome text then
// just falls back to the default locale - see loadBundles' resolveLocale).
//
// Deduped by primary subtag rather than the exact tag, so a bare "nl" found on some sh:name
// doesn't sit alongside the "nl-NL" .ftl locale as a second, redundant "Dutch" entry - the .ftl
// locales are checked first, so a regioned tag they ship wins over a bare one later found in the
// shapes graph (matching resolveLocale's own primary-subtag fallback for loading its bundle, and
// bestByLanguage's for picking a label in it).
export const distillInterfaceLanguages: Preprocessor = (environment) => {
  const seen = new Set<string>();
  const interfaceLanguages: BCP47[] = [];

  for (const language of [
    ...Object.keys(mergeLocaleLoaders(environment.interfaceLocales)),
    ...usedLanguages(environment.shapesGraph as RdfStore, LABEL_PREDICATES),
  ] as BCP47[]) {
    const key = primarySubtag(language);
    if (!seen.has(key)) {
      seen.add(key);
      interfaceLanguages.push(language);
    }
  }

  return { ...environment, interfaceLanguages };
};
