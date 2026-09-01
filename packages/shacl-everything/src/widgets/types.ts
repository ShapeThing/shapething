import type { ComponentType } from "react";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { NamedNode, Term } from "@rdfjs/types";
import type { BCP47 } from "@/types/BCP47.ts";

export type WidgetProps = {
  shape: PropertyUIElement;
  term: Term;
  setTerm: (newTerm: Term) => void;
  // Id of the FormElement <label> describing this property, for the widget's actual control(s) to
  // reference via aria-labelledby - PropertyUIComponent can render several widget instances (one
  // per value) under a single label, so this is a many-to-one aria-labelledby rather than a
  // one-to-one htmlFor/id pairing.
  labelledBy?: string;
};

export type WidgetComponent = ComponentType<WidgetProps>;

/**
 * Facet mode has no single focus node, so a facet widget's props look nothing like an editor's/
 * viewer's term+setTerm: `shape` is still the (possibly synthetic, see the root type/category
 * selector) PropertyUIElement metadata comes from, `values` is every value found for this
 * property across every target instance (see structure/facetValues.ts's aggregateFacetValues -
 * used to derive range bounds/option lists, not a single current value), and
 * getConstraint/setConstraint read/write this property's own constraint node on the live,
 * generated filterShape (see structure/filterShape.ts) - the facet-mode analogue of term/setTerm.
 * setConstraint(predicate, undefined) removes that predicate's current value(s) entirely.
 *
 * `valueCounts` is only given when Environment.enableFacetOptionCounts is on (see
 * structure/facetValues.ts's aggregateFacetValueCounts) - keyed by termKey, "how many target
 * instances have this value, given every other currently-active facet constraint" (a live,
 * re-narrowing count - see structure/filterShape.ts's instancesMatchingOtherConstraints, which
 * FacetPropertyComponent applies before counting). Option-based widgets (CategoryFacet) use it to
 * show a "(n)" count next to each option; a widget with no notion of discrete options
 * (TextSearchFacet, the range facets) simply ignores it.
 *
 * `rangeMatchCount` is only given when Environment.enableFacetOptionCounts is on *and* at least
 * one of sh:minInclusive/sh:maxInclusive is currently set on this property's filterShape
 * constraint (see structure/facetValues.ts's countFacetInstancesInRange) - "how many target
 * instances (again narrowed by every other active facet constraint) have a value inside the
 * currently-entered range", the range-facet analogue of `valueCounts`. A range widget
 * (NumberRangeFacet/DateRangeFacet/DateTimeRangeFacet) shows it once a bound is filled in; an
 * option-based widget (CategoryFacet) simply ignores it.
 *
 * `searchMatchCount` is only given when Environment.enableFacetOptionCounts is on *and*
 * sh:pattern is currently set on this property's filterShape constraint (see
 * structure/facetValues.ts's countFacetInstancesMatchingPattern) - "how many target instances
 * (again narrowed by every other active facet constraint) have a value matching the
 * currently-entered search text", the text-search analogue of `valueCounts`/`rangeMatchCount`.
 * TextSearchFacet shows it once something is typed; every other widget simply ignores it.
 */
export type FacetWidgetProps = {
  shape: PropertyUIElement;
  values: Term[];
  getConstraint: (predicate: NamedNode) => Term[];
  setConstraint: (predicate: NamedNode, value: Term | Term[] | undefined) => void;
  valueCounts?: Map<string, number>;
  rangeMatchCount?: number;
  searchMatchCount?: number;
  labelledBy?: string;
};

export type FacetWidgetComponent = ComponentType<FacetWidgetProps>;

export type CreateTermContext = {
  contentLanguage: BCP47;
};

/**
 * A widget's meta.ts. `createTerm` is only needed when the fresh/empty term a widget produces
 * can't be read straight off the property shape - e.g. it depends on a runtime setting (the
 * active content language) or on inspecting sh:in's members at runtime. Everything else falls
 * back to the generic, shape-derived default in defaultTerm.ts.
 */
export type WidgetMeta = {
  createTerm?: (context: CreateTermContext, shape: PropertyUIElement) => Term;
  canAddMore?: (shape: PropertyUIElement) => boolean;
  // When true for a given shape, this widget renders once for the whole property instead of
  // once per value (PropertyUIComponent skips its per-value "+"/"-" buttons) - the widget reads
  // and writes the full value set itself via `shape` (see SubClassEditor for the first example).
  singleUnifiedWidget?: (shape: PropertyUIElement) => boolean;
  // True for a widget that reads/writes useContentLanguage()'s activeLanguage while editing (e.g.
  // TextFieldWithLangEditor, TextAreaWithLangEditor) - lets ContentLanguageSwitcher hide itself
  // when nothing in the current form would actually respond to it.
  needsLanguageSwitcher?: boolean;
};

export type GroupWidgetProps = { group: GroupUIElement };
export type GroupWidgetComponent = ComponentType<GroupWidgetProps>;

/**
 * One entry in the pluggable widget registry (see widgets/registry.ts's defaultWidgets /
 * Environment.widgets). `widget` is the entry's own IRI - the source of truth used for matching -
 * not whatever key it happens to be stored under in a Widgets record (that key is purely a
 * human-readable label for override purposes, e.g. `{ ...defaultWidgets.editors, TextFieldEditor:
 * MyWidget }`).
 */
export type WidgetRegistryEntry = {
  widget: NamedNode;
  Component: WidgetComponent;
  meta?: WidgetMeta;
  // Raw turtle shui:WidgetScore rules for this widget (see scoring/score.ts) - omit for a widget
  // declared only via an explicit shui:editor/shui:viewer value on the shape, with no scoring
  // rules of its own (see prepareScoringGraph's synthesized default-score fallback).
  scoringGraph?: string;
};

/**
 * A facets-category registry entry (see Widgets.facets) - same scoring-graph/explicit-declaration
 * story as an editor/viewer (see registry.ts's buildEntries, prepareScoringGraph's st:facet
 * handling), just a different Component prop shape (FacetWidgetProps, not WidgetProps).
 */
export type FacetWidgetRegistryEntry = {
  widget: NamedNode;
  Component: FacetWidgetComponent;
  scoringGraph?: string;
};

/**
 * A group widget is selected by simple, direct rdf:type matching (see registry.ts's
 * getGroupWidget) - no scoring system, so there's no scoringGraph here.
 */
export type GroupWidgetRegistryEntry = {
  widget: NamedNode;
  Component: GroupWidgetComponent;
};

/**
 * The complete pluggable widget set a render tree resolves widgets from. `Environment.widgets`
 * defaults to `defaultWidgets` (registry.ts) when the caller supplies none at all; supplying any
 * value here - even a partial replacement built by spreading `defaultWidgets` - means the bundled
 * widgets never load, full stop (see preprocess/widgets.ts's resolveWidgets).
 */
export type Widgets = {
  editors: Record<string, WidgetRegistryEntry>;
  viewers: Record<string, WidgetRegistryEntry>;
  groups: Record<string, GroupWidgetRegistryEntry>;
  facets: Record<string, FacetWidgetRegistryEntry>;
};
