import { useRef, useSyncExternalStore } from "react";
import type { Term } from "@rdfjs/types";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useValidationStore } from "@/outputs/render/hooks/useValidation.tsx";
import { useSubmitAttempt } from "@/outputs/render/hooks/useSubmitAttempt.tsx";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";
import {
  propertyResultKey,
  shallowEqualArrays,
  type ValidationIndex,
} from "@/outputs/render/contexts/validationIndex.ts";

/**
 * Whether `result` belongs to `propertyUIElement` - PropertyUIElement instances are rebuilt fresh
 * on every render (see childrenForShape.ts), so this matches structurally rather than by object
 * identity: same focus node, and the result's sh:sourceShape is one of this element's own grouped
 * property shapes (propertiesForShape groups every sh:PropertyShape sharing a path into one
 * element, so a result sourced from any of them belongs here). selectPropertyResults below is the
 * indexed equivalent the hook actually uses.
 */
export function matchesProperty(
  result: ValidationResult,
  propertyUIElement: Pick<PropertyUIElement, "focusNode" | "propertyShapes">,
): boolean {
  if (!result.focusNode.equals(propertyUIElement.focusNode)) return false;
  if (!result.sourceShape) return false;
  return propertyUIElement.propertyShapes.some((shape) => shape.equals(result.sourceShape));
}

// Which of a property's results a caller wants: all of them, only the property-wide ones (no
// `value`, e.g. sh:minCount), or only those attributed to one specific value (e.g. sh:pattern).
export type ValidationResultScope = "all" | "property-wide" | { value: Term };

const EMPTY: ValidationResult[] = [];

export function selectPropertyResults(
  index: ValidationIndex,
  propertyUIElement: Pick<PropertyUIElement, "focusNode" | "propertyShapes">,
  scope: ValidationResultScope = "all",
): ValidationResult[] {
  const groups = propertyUIElement.propertyShapes.map(
    (shape) => index.byProperty.get(propertyResultKey(propertyUIElement.focusNode, shape)) ?? EMPTY,
  );
  const results = groups.length === 1 ? groups[0] : groups.flat();
  if (scope === "all") return results;
  if (scope === "property-wide") return results.filter((result) => !result.value);
  return results.filter((result) => result.value?.equals(scope.value));
}

/**
 * `propertyUIElement`'s validation results (narrowed by `scope`, see ValidationResultScope),
 * subscribed to per caller: returns the same array instance for as long as its contents are
 * unchanged, so a revalidation run that didn't touch this property's results doesn't re-render it
 * (see validationIndex.ts's identity reuse). Withheld (returns []) until the form's first submit
 * attempt (see EditModeWrapper in modes/edit/index.tsx), so an untouched field's e.g. sh:minCount
 * violation doesn't display as an error before the user has tried to submit.
 */
export function usePropertyValidationResults(
  propertyUIElement: PropertyUIElement,
  scope: ValidationResultScope = "all",
): ValidationResult[] {
  const store = useValidationStore();
  const { hasAttemptedSubmit } = useSubmitAttempt();
  const lastRef = useRef<ValidationResult[]>(EMPTY);

  const getSnapshot = () => {
    if (!hasAttemptedSubmit) return EMPTY;
    const selected = selectPropertyResults(store.getSnapshot().index, propertyUIElement, scope);
    if (shallowEqualArrays(selected, lastRef.current)) return lastRef.current;
    lastRef.current = selected;
    return selected;
  };

  return useSyncExternalStore(store.subscribe, getSnapshot);
}
