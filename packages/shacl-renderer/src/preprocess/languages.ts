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

// Runs after resolveRdfSources, so dataGraph is always a resolved RdfStore here even though
// RawEnvironment's type still allows an unresolved RdfSource.
//
// A caller-supplied contentLanguages is authoritative: it overrules whatever is actually present
// in dataGraph, rather than merely seeding the list. This lets an embedder pin a form to e.g. just
// "nl-NL" even though the data graph also carries "en" literals - those simply stay hidden/unedited
// rather than leaking a second language into the switcher. Only when nothing is configured do we
// fall back to discovering languages from dataGraph.
//
// Only dataGraph is scanned - shapesGraph holds shape metadata (sh:name/sh:description chrome
// labels, sh:message, etc.), not content, so any language tag found there belongs to
// interfaceLanguages (see distillInterfaceLanguages below), never here. Scanning it here too would
// mix the two: a shape whose sh:name happens to be authored in French would offer French as a
// content language even though no French data exists.
export const distillLanguages = ((environment) => {
  const configured = environment.contentLanguages ?? [];

  if (configured.length > 0) {
    return { ...environment, contentLanguages: configured };
  }

  const seen = new Set<string>();
  const contentLanguages: BCP47[] = [];
  for (const language of usedLanguages(environment.dataGraph as RdfStore)) {
    const key = primarySubtag(language);
    if (!seen.has(key)) {
      seen.add(key);
      contentLanguages.push(language);
    }
  }

  // Nothing configured and no rdf:langString tag found anywhere - rather than leave the content
  // language switcher/filterByContentLanguage with an empty list to work from, fall back to
  // contentLanguage itself (English by default - see defaultEnvironment).
  if (contentLanguages.length === 0) {
    contentLanguages.push(environment.contentLanguage);
  }

  return { ...environment, contentLanguages };
}) satisfies Preprocessor;

// Every language available for the interface (chrome) to switch to: the shipped/overridden
// Fluent locales (see l10n/locales.ts), unioned with whatever language sh:name/sh:description
// happen to be authored in across the shapes graph - but only when
// enableInterfaceLanguageWithShapesLabelsOnly is set. Without it, interfaceLanguages is exactly
// the .ftl locale set, so removing a built-in locale (e.g. `interfaceLocales: { "nl-NL": null }`)
// actually removes it from the switcher rather than having it silently reappear because some
// shape happens to carry a label in that language. With the flag on, a form whose property shapes
// carry Frisian sh:name literals can be switched to even without a Frisian .ftl bundle (chrome
// text then just falls back to the default locale - see loadBundles' resolveLocale).
//
// Deduped by primary subtag rather than the exact tag, so a bare "nl" found on some sh:name
// doesn't sit alongside the "nl-NL" .ftl locale as a second, redundant "Dutch" entry - the .ftl
// locales are checked first, so a regioned tag they ship wins over a bare one later found in the
// shapes graph (matching resolveLocale's own primary-subtag fallback for loading its bundle, and
// bestByLanguage's for picking a label in it).
export const distillInterfaceLanguages = ((environment) => {
  const { enableInterfaceLanguageWithShapesLabelsOnly } = environment;
  const seen = new Set<string>();
  const interfaceLanguages: BCP47[] = [];

  const shapeLanguages = usedLanguages(environment.shapesGraph as RdfStore, LABEL_PREDICATES);

  for (const language of [
    ...Object.keys(mergeLocaleLoaders(environment.interfaceLocales)),
    ...(enableInterfaceLanguageWithShapesLabelsOnly ? shapeLanguages : []),
  ] as BCP47[]) {
    const key = primarySubtag(language);
    if (!seen.has(key)) {
      seen.add(key);
      interfaceLanguages.push(language);
    }
  }

  return { ...environment, interfaceLanguages };
}) satisfies Preprocessor;
