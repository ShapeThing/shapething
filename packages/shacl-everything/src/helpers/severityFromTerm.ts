import type { Term } from "@rdfjs/types";
import { sh } from "@/helpers/namespaces.ts";
import type { Severity } from "@/types/severity.ts";

const SEVERITY_BY_TERM = new Map<string, Severity>([
  [sh("Violation").value, "error"],
  [sh("Warning").value, "warning"],
  [sh("Info").value, "info"],
]);

// Maps a declared sh:severity value (e.g. sh:Warning, as returned by PropertyUIElement.get()) to
// the lowercase Severity used for styling (see theme/index.css's severity-warning/severity-error/
// severity-info classes). Undefined for an undeclared severity - SHACL's implicit sh:Violation
// default is left to callers to apply, same convention as PropertyUIElement.get() itself follows
// for e.g. sh:minCount's default of 0 - or for a term this isn't one of the three sh:Severity
// individuals.
export function severityFromTerm(term: Term | undefined): Severity | undefined {
  return term && SEVERITY_BY_TERM.get(term.value);
}
