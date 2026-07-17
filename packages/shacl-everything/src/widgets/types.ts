import type { ComponentType } from "react";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import type { BCP47 } from "@/types/BCP47.ts";

export type WidgetProps = {
  shape: PropertyUIElement;
  term: Term;
  setTerm: (newTerm: Term) => void;
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
};
