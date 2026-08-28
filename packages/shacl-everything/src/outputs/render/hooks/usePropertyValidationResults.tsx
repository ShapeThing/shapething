import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useValidation } from "@/outputs/render/hooks/useValidation.tsx";
import { useSubmitAttempt } from "@/outputs/render/hooks/useSubmitAttempt.tsx";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";

/**
 * Whether `result` belongs to `propertyUIElement` - PropertyUIElement instances are rebuilt fresh
 * on every render (see childrenForShape.ts), so this matches structurally rather than by object
 * identity: same focus node, and the result's sh:sourceShape is one of this element's own grouped
 * property shapes (propertiesForShape groups every sh:PropertyShape sharing a path into one
 * element, so a result sourced from any of them belongs here).
 */
export function matchesProperty(
  result: ValidationResult,
  propertyUIElement: Pick<PropertyUIElement, "focusNode" | "propertyShapes">,
): boolean {
  if (!result.focusNode.equals(propertyUIElement.focusNode)) return false;
  if (!result.sourceShape) return false;
  return propertyUIElement.propertyShapes.some((shape) => shape.equals(result.sourceShape));
}

/**
 * Every validation result for `propertyUIElement`, both property-wide (e.g. sh:minCount, which
 * has no `value`) and per-value (e.g. sh:pattern/sh:datatype tied to one specific value) - callers
 * filter further by `value` as needed (see PropertyUIComponent.tsx/PropertyUIComponentObject.tsx).
 * Withheld (returns []) until the form's first submit attempt (see EditModeWrapper in
 * modes/edit/index.tsx), so an untouched field's e.g. sh:minCount violation doesn't display as an
 * error before the user has tried to submit.
 */
export function usePropertyValidationResults(
  propertyUIElement: PropertyUIElement,
): ValidationResult[] {
  const { results } = useValidation();
  const { hasAttemptedSubmit } = useSubmitAttempt();
  if (!hasAttemptedSubmit) return [];
  return results.filter((result) => matchesProperty(result, propertyUIElement));
}
