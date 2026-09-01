import type { NamedNode, Quad, Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { ex } from "@/helpers/namespaces.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import type { RdfSource } from "@/types/RdfSource.ts";
import type { LocaleLoaderOverrides } from "@/l10n/locales.ts";
import type { Widgets } from "@/widgets/types.ts";

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
  // Existing triples also present here render read-only in edit mode - their shui:viewer widget
  // instead of their shui:editor, with no remove control - found by walking a property's own path
  // through this graph the same way getObjects() walks dataGraph (see
  // PropertyUIElement.isReadOnly()). Driven purely by graph membership, nothing else: there is no
  // per-shape/per-widget declarative opt-in (yet) - the motivating case is an embedder materializing
  // inferred/derived triples into dataGraph alongside the user's own asserted ones, which shouldn't
  // be directly editable. Unset (the default) means nothing is read-only, same as before this field
  // existed. Ignored outside mode "edit".
  readOnlyGraph?: RdfStore;
  // The pluggable widget set to resolve editors/viewers/groups from (see widgets/types.ts's
  // Widgets, widgets/registry.ts's defaultWidgets). Left unset here - same convention as
  // scoresGraph starting empty - and filled in by preprocess/widgets.ts's resolveWidgets, which
  // defaults to defaultWidgets only when the caller supplies nothing at all: any value given here,
  // even a partial replacement built by spreading defaultWidgets, means the bundled widgets never
  // load.
  widgets?: Widgets;
  // Ignored in facet mode except for one thing: modes/facet/index.tsx reuses it (when set to
  // anything other than the default placeholder) as the IRI of the generated filter shape itself
  // - see structure/filterShape.ts's createFilterShape. Facet mode has no single focus node to
  // render, so there's nothing else this field could otherwise mean there.
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
  // How a property's label is positioned relative to its value in VIEW MODE ONLY (edit mode
  // always stacks the label above the value, unaffected by this): "block" (the default) stacks
  // the label above the value, same as edit mode; "inline" places it beside the value on the same
  // line instead. A single global setting for now - not read from shapes - though a preprocessor
  // could later derive it per-property/per-shape and fold it in here before render, the same way
  // scoresGraph etc. get resolved. See FormElement's own labelLayout prop, applied in view mode's
  // PropertyUIComponent.
  viewModeLabelLayout: "block" | "inline";
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
  // When true, languages detected on sh:name/sh:description in the shapes graph but not covered
  // by an interface locale are also offered in the interface language switcher - useful when the
  // shapes graph contains labels in a language the library doesn't ship a translation for. When
  // false, interfaceLanguages is exactly the .ftl locale set, so removing a built-in locale via
  // `interfaceLocales` (e.g. `{ "nl-NL": null }`) actually removes it rather than having it
  // reappear because some shape happens to carry a label in that language. true in
  // defaultEnvironment, false in minimalEnvironment.
  enableInterfaceLanguageWithShapesLabelsOnly?: boolean;
  // Enables the "Edit in place" button on shui:EnumSelectEditor when the selected value is a sh:node. When false, the button will not be shown and the user will have to navigate to the linked resource to edit it.
  enableEditInPlace?: boolean;
  // Enables shui:LabelViewer opening an IRI value read-only in a modal (via resolution/targets.ts's
  // shapesTargetingNode) when that value both already exists in dataGraph and is targeted by a
  // shape in shapesGraph, instead of only ever linking out to it. When false (or when the value
  // has no shape to render), the link behaves as a plain external link.
  enableViewInPlace?: boolean;
  // Enables a "Create new" option on reference-picking widgets (shui:InstancesSelectEditor,
  // shui:AutoCompleteEditor) for properties whose value is a resource (sh:class), in addition to
  // picking one of the resources already in dataGraph. Mints a fresh instance and opens it for
  // editing right away (see valueNodeShapes) - the sibling feature to enableEditInPlace, for
  // creating rather than editing a referenced resource. When false, only existing instances can be
  // picked, same as before this option existed.
  enableCreateInPlace?: boolean;
  // Called when the edit mode form is submitted - or, in facet mode, with the generated filter
  // shape (see structure/filterShape.ts and facetChangeMode below). Both hand back the same
  // SubmitResult shape (a fresh, non-reactive RdfStore plus its additions/deletions since the
  // session started empty), so a caller doesn't need mode-specific handling to consume either.
  onSubmit?: (result: SubmitResult) => void;
  // Facet mode only. "live" (the default) calls onSubmit continuously, debounced, every time
  // interacting with a facet changes the generated filter shape - matching typical faceted-search
  // UX (results update as you refine). "submit" instead withholds every call until an explicit
  // apply action (facet mode then renders its own <form>/submit button, mirroring edit mode's).
  facetChangeMode?: "live" | "submit";
  // Facet mode only, and only relevant when more than one facetable root shape was discovered
  // (see resolution/targets.ts's facetableRootShapes). When false (the default), NodeUIComponent
  // shows an explicit TypeSelector and renders only the currently-selected type's own properties -
  // switching type prunes constraints that belonged only to the previous one.
  //
  // When true, TypeSelector is dropped entirely and every discovered root shape's properties
  // render together instead, deduplicated by canonical path the same way a single shape's own
  // co-path property shapes already are (see structure/childrenForShape.ts, which already accepts
  // an array of shapes for exactly this). There is no synthetic rdf:type facet in this mode - each
  // ordinary facet becomes an *implicit* type selector on its own: setting a constraint on a
  // property only one type actually has can only ever match instances of that type, without ever
  // needing to say so explicitly. Facets belonging to different types can be set at the same time,
  // which naturally narrows results to their intersection - instances satisfying every constraint
  // given, however many types those constraints happen to be drawn from - rather than forcing a
  // choice of exactly one type up front.
  enableFacetTypeUnion?: boolean;
  // Facet mode only. When true, an ordinary facet (CategoryFacet's options, a range facet's
  // min/max once at least one bound is filled in, or TextSearchFacet once something is typed)
  // shows a "(n)" count - how many target instances currently qualify (see
  // structure/facetValues.ts's aggregateFacetValueCounts/countFacetInstancesInRange/
  // countFacetInstancesMatchingPattern). This is a *live, re-narrowing* count: it excludes instances that
  // fail any *other* currently-active facet constraint (see structure/filterShape.ts's
  // instancesMatchingOtherConstraints), so selecting a value in one facet updates the counts shown
  // on every other facet - typical faceted-search behavior. A facet's own constraint is excluded
  // from narrowing its own counts, so multi-selecting within the same sh:in (an OR) doesn't shrink
  // its sibling options' counts against each other. The option list itself (which values/range
  // exist at all) is unaffected - only the count next to them narrows, so a currently-zero option
  // stays visible rather than disappearing. TypeSelector's own root-shape counts ("Product (n)")
  // are the one exception: they stay a static per-type instance count, not narrowed by other active
  // facets. When false (the default), no count is shown at all, same as before this option existed.
  enableFacetOptionCounts?: boolean;
};

// What flows through the preprocessor chain before it's fully resolved: the graph fields may
// still be an unparsed/undereferenced RdfSource rather than a ready RdfStore. RdfStore is itself
// a valid RdfSource, so a fully-resolved Environment already satisfies this type - preprocessors
// don't need a different type per stage of the chain.
export type RawEnvironment = Omit<
  Environment,
  "shapesGraph" | "dataGraph" | "scoresGraph" | "readOnlyGraph"
> & {
  shapesGraph: RdfSource;
  dataGraph: RdfSource;
  scoresGraph: RdfSource;
  readOnlyGraph?: RdfSource;
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
  viewModeLabelLayout: "block",
  enableWidgetSwitching: true,
  enableLogicalBranchSwitching: true,
  enableContentLanguageCreation: true,
  enableShPathInLabelTitle: true,
  enableFullLanguageRemoval: true,
  enableInterfaceLanguageWithShapesLabelsOnly: true,
  enableEditInPlace: true,
  enableViewInPlace: true,
  enableCreateInPlace: true,
  facetChangeMode: "live",
  enableFacetTypeUnion: false,
  enableFacetOptionCounts: false,
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
  viewModeLabelLayout: "block",
  enableWidgetSwitching: false,
  enableLogicalBranchSwitching: false,
  enableContentLanguageCreation: false,
  enableShPathInLabelTitle: false,
  enableFullLanguageRemoval: false,
  enableInterfaceLanguageWithShapesLabelsOnly: false,
  enableEditInPlace: false,
  enableViewInPlace: false,
  enableCreateInPlace: false,
  facetChangeMode: "live",
  enableFacetTypeUnion: false,
  enableFacetOptionCounts: false,
};

export const minimalEnvironmentWithContentLanguages: Omit<
  Environment,
  "scoresGraph" | "shapesGraph" | "dataGraph"
> = {
  ...minimalEnvironment,
  enableContentLanguageCreation: true,
  contentLanguages: ["en-GB", "nl-NL", "fr-FR"],
};
