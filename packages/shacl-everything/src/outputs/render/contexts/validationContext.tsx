import { createContext } from "react";
import type { Literal, Term } from "@rdfjs/types";

// A flattened, plain-Term view of a shacl-engine ValidateResult (see types/shacl-engine.d.ts) -
// built once when validation runs (see ValidationContextProvider), so nothing downstream needs to
// know about shacl-engine/grapoi's getter-heavy pointer objects, consistent with how the rest of
// the render tree (PropertyUIElement itself) only ever deals in plain Term/RdfStore.
export type ValidationResult = {
  focusNode: Term;
  // The property/node shape this result's sh:sourceShape points at - absent only if shacl-engine
  // itself reports a result with no shape (not expected in practice, kept optional to stay honest
  // about the upstream type).
  sourceShape?: Term;
  // The specific offending value, when the violated constraint concerns one - absent for
  // property-wide constraints like sh:minCount.
  value?: Term;
  severity: Term;
  // Kept as raw language-tagged literals (rather than resolved to a single string here) so the
  // render tree can pick the one matching the current interface language - see PropertyUIComponent/
  // PropertyUIComponentObject, which resolve it the same way sh:name/sh:description are resolved.
  message: Literal[];
};

export type ValidationContextValue = {
  results: ValidationResult[];
  isValidating: boolean;
};

export const validationContext = createContext<ValidationContextValue | undefined>(undefined);
