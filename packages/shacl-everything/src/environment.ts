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
  // Filled in by preprocessing, not by callers: the triples dataGraph gained from its owl:imports
  // (and not asserted by the data itself). They stay in dataGraph so labels/class hierarchies from
  // imported vocabulary still resolve, but this separate record lets SubmitResult.dataGraph leave
  // them out - an embedder gets back only its own data, not the vocabulary it pulled in.
  importedDataGraph?: RdfStore;
  // The pluggable widget set to resolve editors/viewers/groups from (see widgets/types.ts's
  // Widgets, widgets/registry.ts's defaultWidgets). Left unset here - same convention as
  // scoresGraph starting empty - and filled in by preprocess/widgets.ts's resolveWidgets, which
  // defaults to defaultWidgets only when the caller supplies nothing at all: any value given here,
  // even a partial replacement built by spreading defaultWidgets, means the bundled widgets never
  // load.
  widgets?: Widgets;
  // A CORS proxy URL prefix, used as a fallback whenever a network fetch this package makes fails
  // directly - a shapesGraph/dataGraph/scoresGraph/readOnlyGraph URL, an owl:imports target, or a
  // federated shui:searchQuery/sh:select SERVICE endpoint - typically because the remote server
  // doesn't send permissive CORS headers. The direct URL is always tried first (with its own
  // existing retries, where those already exist); only once that's exhausted is the request retried
  // once more through `${corsProxyUrl}${encodeURIComponent(url)}` (e.g. "https://corsproxy.io/?url="
  // or a self-hosted equivalent). Unset (the default) means no fallback - a direct-fetch failure is
  // thrown/rejected the same as before this field existed.
  corsProxyUrl?: string;
  // Ignored in facet mode except for one thing: modes/facet/index.tsx reuses it (when set to
  // anything other than the default placeholder) as the IRI of the generated filter shape itself
  // - see structure/filterShape.ts's createFilterShape. Facet mode has no single focus node to
  // render, so there's nothing else this field could otherwise mean there.
  focusNode: NamedNode;
  nodeShapes: Quad_Subject[];
  // Every `@prefix alias: <base>` (or `PREFIX`/JSON-LD `@context` equivalent) declaration actually
  // found while parsing shapesGraph's and dataGraph's own RDF source text/URLs (see
  // preprocess/resolveRdfSources.ts) - keyed by alias, most-recently-parsed source wins on a
  // clashing alias. This is the one thing resolveRdfSources must capture *during* parsing rather
  // than derive afterwards the way contentLanguages/interfaceLanguages do: a parsed RdfStore holds
  // only quads, not the prefix declarations that produced them. helpers/prefixedIri.ts merges this
  // in over its own hardcoded vocabulary list (preferring a document's own alias for a namespace it
  // already knows) so IRIEditor and friends echo back the same prefix the source document itself
  // used, not an unrelated guess. Empty when every source was an already-materialized RdfStore/Quad
  // array (e.g. an embedder passing in pre-parsed data) - there's no source text left to read a
  // prefix declaration from in that case.
  sourcePrefixes: Record<string, string>;
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
  // When a property's sh:path is a top-level sh:alternativePath whose every branch is a plain
  // predicate (e.g. `sh:alternativePath (dc:title rdfs:label)`), allow switching which branch
  // predicate an existing value is stored under (see PropertyUIElement.setAlternativePathBranch). A
  // "complex" alternative (any branch that's itself a sequence/inverse/nested alternative) has no
  // single, unambiguous place to move a value to or from and is unaffected by this flag - it always
  // stays read-only for writes, the same as before this flag existed. If false, the first branch
  // already holding a value (or the first declared branch, if none do) is used for every write and
  // no switching is possible.
  enableAlternativePathSwitching?: boolean;
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
  // Shows a link icon next to a NamedNode value in AutoCompleteOption (used by
  // shui:AutoCompleteEditor/InstancesSelectEditor's dropdown and selected-value display), linking
  // out to the term's own IRI in a new tab. When false, the icon is omitted and the value is
  // otherwise not directly navigable to from there.
  enableLinksToResources?: boolean;
  // Edit mode only. Enables Ctrl+Z/Ctrl+Y (and Ctrl+Shift+Z as a redo alias) to undo/redo edits to
  // dataGraph for the current session (see helpers/reactiveRdfStore.ts's History, and
  // EditModeWrapper). Ignored while focus is inside a text input/textarea/contentEditable element,
  // so the browser's own native text-undo still works for an in-progress, not-yet-committed edit.
  // Set to false when an embedder's host page already binds these keys to something else.
  enableUndoRedo?: boolean;
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
  // shows a count - how many target instances currently qualify, each a COUNT(DISTINCT) query
  // against the facet source (see facets/facetQueries.ts). This is a *live, re-narrowing* count:
  // it excludes instances that fail any *other* currently-active facet constraint (see
  // facets/compileFilter.ts), so selecting a value in one facet updates the counts shown
  // on every other facet - typical faceted-search behavior. A facet's own constraint is excluded
  // from narrowing its own counts, so multi-selecting within the same sh:in (an OR) doesn't shrink
  // its sibling options' counts against each other. The option list itself (which values/range
  // exist at all) is unaffected - only the count next to them narrows, so a currently-zero option
  // stays visible rather than disappearing. TypeSelector's own root-shape counts ("Product (n)")
  // are the one exception: they stay a static per-type instance count, not narrowed by other active
  // facets. When false (the default), no count is shown at all, same as before this option existed.
  enableFacetOptionCounts?: boolean;
  // When true, preprocess/shapes.ts's addMissingShapes scans dataGraph for classes (rdf:type
  // values) that no shape in shapesGraph already targets, and mints a synthetic sh:NodeShape -
  // sh:targetClass - with a bare sh:property/sh:path for each predicate actually used by that
  // class's instances, so otherwise-unshaped data still renders as something editable. A class
  // already covered by some shape is left untouched, even if that shape is missing some properties
  // its instances carry. Off by default: a shapesGraph is normally authored deliberately, and this
  // is meant as a fallback for exploring/rendering data that has none, not a silent, ongoing
  // overlay on top of an intentionally scoped shape.
  enableMissingShapesGeneration?: boolean;
  // When true, preprocess/ontologyLabels.ts's dereferenceMissingPropertyNames scans shapesGraph for
  // property shapes (sh:path) whose path is a plain predicate IRI and that have no sh:name (or
  // whatever shui:labelPreference configures instead) in any language, dereferences that predicate's
  // own IRI over HTTP, and merges whichever rdfs:label triples it finds there (describing the
  // predicate itself) into shapesGraph - so propertyLabel() (resolution/label.ts) still has
  // something better than the raw local name to fall back to. A predicate that fails to dereference
  // is skipped, not thrown. Off by default: this fires one HTTP request per otherwise-unnamed
  // property, which isn't free and depends on the ontology's own IRI actually being dereferenceable.
  enableMissingPropertyNameDereferencing?: boolean;
  // Facet mode only. When true, preprocess/shapes.ts's mergeFacetTextSearchProperties folds every
  // sh:property of a facetable root shape (resolution/targets.ts's facetableRootShapes) that
  // declares sh:datatype xsd:string/rdf:langString and has no st:facet of its own into one combined
  // property instead - sh:path an sh:alternativePath across all of their predicates, explicitly
  // tagged st:facet st:TextSearchFacet - so there is one free-text search box covering every such
  // field at once, rather than a separate search box per plain text property. Facet widgets are
  // otherwise entirely hardcoded via st:facet, so a property already given one (any widget,
  // including TextSearchFacet itself) is left exactly as it was, never folded in. Off by default: a
  // shapesGraph that deliberately gives each string property its own st:facet should stay that way
  // unless this merge is opted into.
  enableFacetTextSearchMerging?: boolean;
  // Enables an alternate search flow on shui:AutoCompleteEditor: clicking its search icon opens a
  // modal containing a nested ShaclRenderer in facet mode (mode: "facet", see modes/facet/), so the
  // user can narrow candidates down through facets instead of only free-text search - handy once a
  // class has enough properties that typing a label isn't the fastest way to find one. Facet mode
  // has no results list of its own (see FacetModeWrapper's doc comment - it only ever hands the
  // generated filter shape to onSubmit); AutoCompleteEditor's own modal supplies one by applying
  // that filter shape to its candidates (facets/facetQueries.ts's instancesMatchingFilterShape).
  // Only takes effect when the property actually has a known value node shape to facet against
  // (see resolution/label.ts's valueNodeShapes - the same emptiness check enableCreateInPlace/
  // enableEditInPlace already gate on); when false (the default) or when there's no such shape, the
  // search icon always just opens the ordinary inline typeahead, same as before this option
  // existed.
  enableFacetSearchForAutocomplete?: boolean;
  // MapLibre GL style URL used by every map-based st: widget (GeoEditor, MapViewer, MapFacet) -
  // a single shared setting rather than a per-widget one, since they're always meant to look the
  // same within one embedder. Defaults to a public OpenFreeMap style; override to point at a
  // self-hosted or branded style instead.
  mapStyleUrl?: string;
  // Facet mode only. A SPARQL endpoint URL the facets query instead of the local dataGraph - option
  // values, counts, range bounds and the matching instances are all answered by SPARQL queries sent
  // to this endpoint (see facets/facetQueries.ts), so facet mode works over a dataset far too large
  // to load into the browser. Each query is shipped whole, in one request, so the endpoint does the
  // aggregation. Unset (the default) runs the exact same queries against the local dataGraph via
  // Comunica. The shapes graph (targets, facet widgets, class taxonomies) is still read locally.
  facetsEndpoint?: string;
};

// What flows through the preprocessor chain before it's fully resolved: the graph fields may
// still be an unparsed/undereferenced RdfSource rather than a ready RdfStore. RdfStore is itself
// a valid RdfSource, so a fully-resolved Environment already satisfies this type - preprocessors
// don't need a different type per stage of the chain.
export type RawEnvironment =
  & Omit<
    Environment,
    "shapesGraph" | "dataGraph" | "scoresGraph" | "readOnlyGraph"
  >
  & {
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
  sourcePrefixes: {},
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
  enableAlternativePathSwitching: true,
  enableContentLanguageCreation: true,
  enableShPathInLabelTitle: true,
  enableFullLanguageRemoval: true,
  enableInterfaceLanguageWithShapesLabelsOnly: true,
  enableEditInPlace: true,
  enableViewInPlace: true,
  enableCreateInPlace: true,
  enableLinksToResources: true,
  enableUndoRedo: true,
  facetChangeMode: "live",
  enableFacetTypeUnion: false,
  enableFacetOptionCounts: false,
  enableMissingShapesGeneration: false,
  enableMissingPropertyNameDereferencing: false,
  enableFacetTextSearchMerging: false,
  enableFacetSearchForAutocomplete: false,
  mapStyleUrl: "https://tiles.openfreemap.org/styles/bright",
};

export const minimalEnvironment: Omit<
  Environment,
  "scoresGraph" | "shapesGraph" | "dataGraph"
> = {
  focusNode: ex("focusNode"),
  nodeShapes: [],
  sourcePrefixes: {},
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
  enableAlternativePathSwitching: false,
  enableContentLanguageCreation: false,
  enableShPathInLabelTitle: false,
  enableFullLanguageRemoval: false,
  enableInterfaceLanguageWithShapesLabelsOnly: false,
  enableEditInPlace: false,
  enableViewInPlace: false,
  enableCreateInPlace: false,
  enableLinksToResources: false,
  enableUndoRedo: false,
  facetChangeMode: "live",
  enableFacetTypeUnion: false,
  enableFacetOptionCounts: false,
  enableMissingShapesGeneration: false,
  enableMissingPropertyNameDereferencing: false,
  enableFacetTextSearchMerging: false,
  enableFacetSearchForAutocomplete: false,
  mapStyleUrl: "https://tiles.openfreemap.org/styles/bright",
};

export const minimalEnvironmentWithContentLanguages: Omit<
  Environment,
  "scoresGraph" | "shapesGraph" | "dataGraph"
> = {
  ...minimalEnvironment,
  enableContentLanguageCreation: true,
  contentLanguages: ["en-GB", "nl-NL", "fr-FR"],
};

export const testingEnvironment: Omit<
  Environment,
  "scoresGraph" | "shapesGraph" | "dataGraph"
> = {
  focusNode: ex("focusNode"),
  nodeShapes: [],
  sourcePrefixes: {},
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
  enableAlternativePathSwitching: true,
  enableContentLanguageCreation: true,
  enableShPathInLabelTitle: true,
  enableFullLanguageRemoval: true,
  enableInterfaceLanguageWithShapesLabelsOnly: true,
  enableEditInPlace: true,
  enableViewInPlace: true,
  enableCreateInPlace: true,
  enableLinksToResources: true,
  enableUndoRedo: true,
  facetChangeMode: "live",
  enableFacetTypeUnion: true,
  enableFacetOptionCounts: true,
  enableMissingShapesGeneration: false,
  enableMissingPropertyNameDereferencing: false,
  enableFacetTextSearchMerging: false,
  enableFacetSearchForAutocomplete: false,
};
