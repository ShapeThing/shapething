import type { Term } from "@rdfjs/types";
import { termKey } from "@/helpers/termKey.ts";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";

/**
 * Validation results grouped once per run by (focusNode, sh:sourceShape) - the same pair
 * matchesProperty (usePropertyValidationResults.tsx) matches a PropertyUIElement on - so each
 * property looks up its own slice instead of re-filtering the whole result list on every run.
 */
export type ValidationIndex = {
  results: ValidationResult[];
  byProperty: Map<string, ValidationResult[]>;
};

export const emptyValidationIndex: ValidationIndex = { results: [], byProperty: new Map() };

export function propertyResultKey(focusNode: Term, sourceShape: Term): string {
  return `${termKey(focusNode)} ${termKey(sourceShape)}`;
}

// Everything a rendered message depends on - two results with the same signature render
// identically, so the older object can stand in for the newer one.
function signature(result: ValidationResult): string {
  return [
    termKey(result.focusNode),
    result.sourceShape ? termKey(result.sourceShape) : "",
    result.value ? termKey(result.value) : "",
    termKey(result.severity),
    ...result.message.map(termKey),
  ].join("\n");
}

export function shallowEqualArrays<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Builds the next run's index, reusing `previous`'s result objects (and whole per-property arrays)
 * wherever they're unchanged - every run produces brand-new result objects, so without this a
 * subscriber comparing its slice by identity would still see "changed" on every single run.
 */
export function indexValidationResults(
  results: ValidationResult[],
  previous: ValidationIndex = emptyValidationIndex,
): ValidationIndex {
  const previousBySignature = new Map<string, ValidationResult[]>();
  for (const result of previous.results) {
    const key = signature(result);
    const queue = previousBySignature.get(key);
    if (queue) queue.push(result);
    else previousBySignature.set(key, [result]);
  }

  const reused = results.map((result) => previousBySignature.get(signature(result))?.shift() ?? result);

  const byProperty = new Map<string, ValidationResult[]>();
  for (const result of reused) {
    if (!result.sourceShape) continue;
    const key = propertyResultKey(result.focusNode, result.sourceShape);
    const group = byProperty.get(key);
    if (group) group.push(result);
    else byProperty.set(key, [result]);
  }
  for (const [key, group] of byProperty) {
    const previousGroup = previous.byProperty.get(key);
    if (previousGroup && shallowEqualArrays(previousGroup, group)) byProperty.set(key, previousGroup);
  }

  return { results: reused, byProperty };
}
