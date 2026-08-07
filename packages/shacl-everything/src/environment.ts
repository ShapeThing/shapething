import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { ex } from "@/helpers/namespaces.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import type { RdfSource } from "@/types/RdfSource.ts";

export type Environment = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph: RdfStore;
  focusNode: NamedNode;
  nodeShapes: Quad_Subject[];
  mode: "edit" | "view" | "facet";
  interfaceLanguage: BCP47;
  contentLanguage: BCP47;
  // Every language available to switch content to: whatever the caller specified, unioned with
  // every language tag actually found in shapesGraph/dataGraph (see preprocess/languages.ts).
  languages: BCP47[];
  // How a multi-lingual property's translations are presented: "switcher" shows one language at
  // a time, controlled by a single global content language switcher (ContentLanguageSwitcher) -
  // every *WithLangEditor widget's own per-value language <select> stays hidden, since there's
  // nothing to pick per value when only one language is ever shown at once. "individual" is the
  // opposite: every existing translation renders side by side, each with its own per-value
  // language <select> to pick/change its language, and there is no global switcher at all.
  languageMode: "switcher" | "individual";
  // When multiple widgets are available for a property, allow switching between them. If false, the first widget will be used and no switching will be possible.
  enableWidgetSwitching?: boolean;
  // When true, ContentLanguageSwitcher offers an option to create a brand new BCP47 content
  // language at runtime, in addition to the ones supplied via `languages`/found in the graphs.
  enableContentLanguageCreation?: boolean;
  // When true, the predicate of a property will be included in the label's title attribute. This is useful for debugging and for users who want to see the underlying data model.
  enableShPathInLabelTitle?: boolean;
};

// What flows through the preprocessor chain before it's fully resolved: the graph fields may
// still be an unparsed/undereferenced RdfSource rather than a ready RdfStore. RdfStore is itself
// a valid RdfSource, so a fully-resolved Environment already satisfies this type - preprocessors
// don't need a different type per stage of the chain.
export type RawEnvironment = Omit<Environment, "shapesGraph" | "dataGraph" | "scoresGraph"> & {
  shapesGraph: RdfSource;
  dataGraph: RdfSource;
  scoresGraph: RdfSource;
};

export const defaultEnvironment: Environment = {
  shapesGraph: RdfStore.createDefault(),
  dataGraph: RdfStore.createDefault(),
  scoresGraph: RdfStore.createDefault(),
  focusNode: ex("focusNode"),
  nodeShapes: [],
  mode: "edit",
  interfaceLanguage: "en-GB",
  contentLanguage: "en-GB",
  languages: [],
  languageMode: "switcher",
  enableWidgetSwitching: true,
  enableContentLanguageCreation: false,
  enableShPathInLabelTitle: true,
};
