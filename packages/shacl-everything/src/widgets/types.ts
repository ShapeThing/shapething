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
};
