import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useLovSuggestions, type Suggestion } from "@/outputs/render/hooks/useLovSuggestions.ts";
import { knownPredicates } from "./knownPredicates.ts";

export type { Suggestion };

// PathItemModal's own predicate suggestion source - the properties-only instantiation of the
// generalized useLovSuggestions (see there, and IRIEditor's own use of it for the shape-
// configurable, class-and-property-capable counterpart).
export function usePredicateSuggestions(
  shape: PropertyUIElement,
  query: string,
  enabled: boolean,
): {
  suggestions: Suggestion[];
  isSearchingLov: boolean;
} {
  const candidates = knownPredicates(shape.dataGraph, shape.shapesGraph);
  return useLovSuggestions(candidates, query, { lovTypes: ["property"], enabled });
}
