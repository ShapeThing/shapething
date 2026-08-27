import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";
import { localName } from "@/helpers/localName.ts";

// sh:Violation is the strictest, then sh:Warning, then sh:Info - same ranking documented in
// structure/constraintResolutions.ts's keepMostSevere, reimplemented here since that function's
// signature is shaped for shape-value resolution (values, element, predicate), not for picking
// the worst of a plain Term list.
const SEVERITY_RANK: Record<string, number> = {
  Violation: 2,
  Warning: 1,
  Info: 0,
};

// The worst (most severe) sh:severity local name across a set of validation results, e.g.
// "Violation" beating "Warning" beating "Info". Undefined only when `results` is empty.
export function worstSeverity(results: ValidationResult[]): string | undefined {
  return results.reduce<string | undefined>((worst, result) => {
    const name = localName(result.severity) ?? "Violation";
    if (!worst || (SEVERITY_RANK[name] ?? 0) > (SEVERITY_RANK[worst] ?? 0)) return name;
    return worst;
  }, undefined);
}
