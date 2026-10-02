import { useContext } from "react";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";
import { reportResultsContext } from "@/outputs/render/contexts/reportResultsContext.tsx";
import { selectPropertyResults } from "@/outputs/render/hooks/usePropertyValidationResults.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

const EMPTY: ValidationResult[] = [];

/** Report mode's results for `propertyUIElement` (see reportResultsContext). Always empty outside report mode. */
export function useReportResults(propertyUIElement: PropertyUIElement): ValidationResult[] {
  const index = useContext(reportResultsContext);
  if (!index) return EMPTY;
  const results = selectPropertyResults(index, propertyUIElement);
  return results.length ? results : EMPTY;
}

/** Whether the view-mode tree is rendering a validation report (see modes/report/). */
export function useIsReport(): boolean {
  return useContext(reportResultsContext) !== undefined;
}

