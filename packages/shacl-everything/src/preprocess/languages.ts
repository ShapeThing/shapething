import type { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import type { BCP47 } from "@/types/BCP47.ts";

// Every distinct rdf:langString language tag actually used in `store`, in first-seen order.
function usedLanguages(store: RdfStore): BCP47[] {
  const seen = new Set<string>();
  const languages: BCP47[] = [];

  for (const quad of store.getQuads()) {
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

// Runs after resolveRdfSources, so shapesGraph/dataGraph are always resolved RdfStores here even
// though RawEnvironment's type still allows an unresolved RdfSource.
export const distillLanguages: Preprocessor = (environment) => {
  const configured = environment.languages ?? [];
  const seen = new Set(configured.map((language) => language.toLowerCase()));

  const languages = [...configured];
  for (const language of [
    ...usedLanguages(environment.shapesGraph as RdfStore),
    ...usedLanguages(environment.dataGraph as RdfStore),
  ]) {
    const key = language.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      languages.push(language);
    }
  }

  return { ...environment, languages };
};
