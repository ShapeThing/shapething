import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { ex } from "@/helpers/namespaces.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import type { RdfSource } from "@/types/RdfSource.ts";
import type { LocaleLoaderOverrides } from "@/l10n/locales.ts";

export type Environment = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph: RdfStore;
  focusNode: NamedNode;
  nodeShapes: Quad_Subject[];
  mode: "edit" | "view" | "facet";
  interfaceLanguage: BCP47;
  // Interface locales (Fluent .ftl loaders), keyed by BCP47 tag, layered over the ones the
  // library ships out of the box. A tag already shipped built-in can be given here too, either to
  // override it with the caller's own translation, or to remove it entirely by giving `null` -
  // e.g. to ship with just a single interface language and no InterfaceLanguageSwitcher at all.
  // See l10n/locales.ts for the built-in set.
  interfaceLocales: LocaleLoaderOverrides;
  // Every language available to switch the interface (chrome) to: the shipped/overridden .ftl
  // locales unioned with every language tag found on sh:name/sh:description in shapesGraph (see
  // preprocess/languages.ts) - so a shape authored with labels in a language the library has no
  // .ftl translation for can still be selected, even though chrome text itself then falls back.
  interfaceLanguages: BCP47[];
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
  // When true, shows a trash icon inside the content language switcher.
  enableFullLanguageRemoval?: boolean;
};

// What flows through the preprocessor chain before it's fully resolved: the graph fields may
// still be an unparsed/undereferenced RdfSource rather than a ready RdfStore. RdfStore is itself
// a valid RdfSource, so a fully-resolved Environment already satisfies this type - preprocessors
// don't need a different type per stage of the chain.
export type RawEnvironment =
  & Omit<Environment, "shapesGraph" | "dataGraph" | "scoresGraph">
  & {
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
  interfaceLocales: {},
  interfaceLanguages: [],
  contentLanguage: "en-GB",
  languages: [],
  languageMode: "switcher",
  enableWidgetSwitching: true,
  enableContentLanguageCreation: true,
  enableShPathInLabelTitle: true,
  enableFullLanguageRemoval: true,
};

export const minimalEnvironment: Environment = {
  shapesGraph: RdfStore.createDefault(),
  dataGraph: RdfStore.createDefault(),
  scoresGraph: RdfStore.createDefault(),
  focusNode: ex("focusNode"),
  nodeShapes: [],
  mode: "edit",
  interfaceLanguage: "en-GB",
  interfaceLocales: {
    "nl-NL": null, // remove Dutch from the shipped set, so only en-GB is available
  },
  interfaceLanguages: [],
  contentLanguage: "en-GB",
  languages: [],
  languageMode: "switcher",
  enableWidgetSwitching: false,
  enableContentLanguageCreation: false,
  enableShPathInLabelTitle: false,
  enableFullLanguageRemoval: false,
};

export const minimalEnvironmentWithContentLanguages: Environment = {
  ...minimalEnvironment,
  enableContentLanguageCreation: true,
  languages: ["en-GB", "nl-NL", "fr-FR"],
};
