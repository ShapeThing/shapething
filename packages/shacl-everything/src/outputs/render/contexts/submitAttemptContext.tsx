import { createContext } from "react";

// Kept separate from validationContext (rather than folded into it) so that a background
// revalidation run - which updates validationContext's `results`/`isValidating` on every
// `dataGraph` write, see ValidationContextProvider - never forces EditModeWrapper to re-render.
// EditModeWrapper sits above NodeUIComponent, and PropertyUIElement instances are rebuilt fresh on
// every render (see structure/childrenForShape.ts); re-rendering from that high up would hand
// useWidget's Suspense queries fresh cache keys on every property, remounting widgets mid-edit and
// stealing focus. EditModeWrapper only updates this context once, in response to the form's own
// submit event - see its own comment for the full reasoning.
export type SubmitAttemptContextValue = {
  hasAttemptedSubmit: boolean;
  markSubmitAttempted: () => void;
};

export const submitAttemptContext = createContext<SubmitAttemptContextValue | undefined>(undefined);
