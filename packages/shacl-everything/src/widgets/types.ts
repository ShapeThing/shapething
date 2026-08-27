import type { ComponentType } from "react";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
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
