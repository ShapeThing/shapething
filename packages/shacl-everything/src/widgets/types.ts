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
  // True for exactly the one widget instance that was just mounted by a "+"/"Add item" click (see
  // PropertyUIComponentValues/MemberShapeList) - never true merely because a value is empty, so a
  // form with several already-empty properties never races over which one steals focus. A widget
  // with a single focusable control should focus it on mount when this is true (see
  // useAutoFocusRef); a composite widget with no control of its own (DetailsEditor) forwards it
  // into its nested form's first field instead (see NodeUIElementChildren's autoFocusFirst).
  autoFocus?: boolean;
};

export type WidgetComponent = ComponentType<WidgetProps>;

/**
 * Facet mode has no single focus node, so a facet widget's props look nothing like an editor's/
 * viewer's term+setTerm: `shape` is still the (possibly synthetic, see the root type/category
 * selector) PropertyUIElement metadata comes from, and getConstraint/setConstraint read/write this
 * property's own constraint node on the live, generated filterShape (see facets/filterShape.ts) -
 * the facet-mode analogue of term/setTerm. setConstraint(predicate, undefined) removes that
 * predicate's current value(s) entirely. A widget reads and writes plain predicates (sh:in,
 * sh:minInclusive, ...); where they physically live in the generated shape is filterShape.ts's
 * concern.
 *
 * setConstraints writes several predicates as one atomic gesture - see facets/filterShape.ts's
 * setFilterConstraintsForProperty for why a widget that needs to write more than one predicate for
 * the same user action must use this instead of two separate setConstraint calls.
 *
 * Data derived from the facet source (the local dataGraph, or Environment.facetsEndpoint) is not
 * passed as props: a widget pulls exactly what it needs through the facet data hooks
 * (outputs/render/modes/facet/facetData.tsx, re-exported from the widget SDK) - useFacetValues for
 * its option list, useFacetValueCounts for live per-option counts, useFacetValueBounds for a range,
 * useFacetColorBuckets for color swatches - each one a SPARQL query, so a widget that shows no
 * counts never costs a count query. A range/search widget's single overall match count is rendered
 * by FacetPropertyComponent onto the surrounding FormElement's label, not by the widget itself.
 */
export type FacetWidgetProps = {
  shape: PropertyUIElement;
  getConstraint: (predicate: NamedNode) => Term[];
  setConstraint: (predicate: NamedNode, value: Term | Term[] | undefined) => void;
  setConstraints?: (entries: ReadonlyArray<readonly [NamedNode, Term | Term[] | undefined]>) => void;
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
  // only ever chosen via an explicit shui:editor/shui:viewer value on the shape: select() returns
  // a shape's own declared widget directly (subject only to its WidgetAcceptMatcher, if any), no
  // scoring rule needed. Such a widget just won't appear among score()'s ranked alternatives.
  scoringGraph?: string;
};

/**
 * A facets-category registry entry (see Widgets.facets) - same scoring-graph/explicit-declaration
 * story as an editor/viewer (see registry.ts's buildFacetEntries/getScoringGraph), just a
 * different Component prop shape (FacetWidgetProps, not WidgetProps).
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
