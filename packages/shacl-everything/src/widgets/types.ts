import type { ComponentType, ReactNode } from "react";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import type { BCP47 } from "@/types/BCP47.ts";

export type WidgetProps = {
  shape: PropertyUIElement;
  term: Term;
  setTerm: (newTerm: Term) => void;
  // The branch/widget switcher PropertyUIComponentObject renders for this property. Ignored by
  // most widgets (which get it rendered after them for free - see PropertyUIComponentObject), but
  // a widget with its own internal structure (e.g. DetailsEditor's label + nested sub-form) can
  // set WidgetComponent.placesOwnFlyOut and take this prop to position it itself - between the
  // label and the sub-form, in DetailsEditor's case - so it lands in the DOM (and hence the tab
  // order) where it actually belongs instead of trailing after the sub-form's own fields.
  flyOut?: ReactNode;
};

export type WidgetComponent = ComponentType<WidgetProps> & { placesOwnFlyOut?: boolean };

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
};
