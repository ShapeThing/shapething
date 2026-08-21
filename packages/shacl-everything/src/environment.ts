import type { NamedNode, Quad, Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { ex } from "@/helpers/namespaces.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import type { RdfSource } from "@/types/RdfSource.ts";
import type { LocaleLoaderOverrides } from "@/l10n/locales.ts";

// What the edit mode form hands back on submit: a fresh RdfStore containing a copy of every quad
// currently in dataGraph (not the live, reactive dataGraph itself), plus the quads added/removed
// since the form was first shown - the diff between dataGraph's quads at mount and at submit time.
export type SubmitResult = {
  dataGraph: RdfStore;
  additions: Quad[];
  deletions: Quad[];
};

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
  // every language tag actually found in dataGraph (see preprocess/languages.ts). shapesGraph is
  // deliberately excluded - its language tags (sh:name/sh:description chrome labels, etc.) feed
  // interfaceLanguages instead, not this.
  contentLanguages: BCP47[];
  // How a multi-lingual property's translations are presented: "switcher" shows one language at
  // a time, controlled by a single global content language switcher (ContentLanguageSwitcher) -
  // every *WithLangEditor widget's own per-value language <select> stays hidden, since there's
  // nothing to pick per value when only one language is ever shown at once. "individual" is the
  // opposite: every existing translation renders side by side, each with its own per-value
  // language <select> to pick/change its language, and there is no global switcher at all.
  languageMode: "switcher" | "individual";
  // When multiple widgets are available for a property, allow switching between them. If false, the first widget will be used and no switching will be possible.
  enableWidgetSwitching?: boolean;
  // When a property has sh:or/sh:xone branches, allow switching between them. If false, the first matching branch will be used and no switching will be possible.
  enableLogicalBranchSwitching?: boolean;
  // When true, ContentLanguageSwitcher (languageMode "switcher") and each value's own
  // ValueLanguageSelect (languageMode "individual") offer an option to create a brand new BCP47
  // language at runtime, in addition to the ones supplied via `languages`/found in the graphs/
  // declared via sh:languageIn.
  enableContentLanguageCreation?: boolean;
  // When true, the predicate of a property will be included in the label's title attribute. This is useful for debugging and for users who want to see the underlying data model.
  enableShPathInLabelTitle?: boolean;
  // When true, shows a trash icon inside the content language switcher.
  enableFullLanguageRemoval?: boolean;
  // Called when the edit mode form is submitted. See SubmitResult.
  onSubmit?: (result: SubmitResult) => void;
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
  interfaceLocales: {},
  interfaceLanguages: [],
  contentLanguage: "en-GB",
  contentLanguages: [],
  languageMode: "switcher",
  enableWidgetSwitching: true,
  enableLogicalBranchSwitching: true,
  enableContentLanguageCreation: true,
  enableShPathInLabelTitle: true,
  enableFullLanguageRemoval: true,
};

export const minimalEnvironment: Omit<Environment, "scoresGraph" | "shapesGraph" | "dataGraph"> = {
  focusNode: ex("focusNode"),
  nodeShapes: [],
  mode: "edit",
  interfaceLanguage: "en-GB",
  interfaceLocales: {
    "nl-NL": null, // remove Dutch from the shipped set, so only en-GB is available
  },
  interfaceLanguages: [],
  contentLanguage: "en-GB",
  contentLanguages: [],
  languageMode: "switcher",
  enableWidgetSwitching: false,
  enableLogicalBranchSwitching: false,
  enableContentLanguageCreation: false,
  enableShPathInLabelTitle: false,
  enableFullLanguageRemoval: false,
};

export const minimalEnvironmentWithContentLanguages: Omit<
  Environment,
  "scoresGraph" | "shapesGraph" | "dataGraph"
> = {
  ...minimalEnvironment,
  enableContentLanguageCreation: true,
  contentLanguages: ["en-GB", "nl-NL", "fr-FR"],
};
