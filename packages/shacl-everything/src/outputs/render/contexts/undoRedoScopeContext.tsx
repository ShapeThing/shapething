import { createContext } from "react";
import type { RdfStore } from "rdf-stores";

// A Modal editing its own staging graph (see AutoCompleteEditor/InstancesSelectEditor's
// create-new flow, AutoCompleteOption's edit-in-place flow) pushes one of these while it's open,
// so EditModeWrapper's single Ctrl+Z/Ctrl+Y listener (document-level, so it still fires regardless
// of exactly what has focus - e.g. after a widget swap moves focus to <body>) undoes/redoes the
// innermost open modal's own graph instead of the outer form's live dataGraph. A stack, not a
// single slot: a modal opened from inside another modal's content (rare, but the same nesting
// Modal's onClose guard already accounts for) still resolves to the most recently opened one.
export type UndoRedoScope = { dataGraph: RdfStore; enabled: boolean };

export type UndoRedoScopeContextValue = {
  /** Pushes `scope` as the active one; call the returned function to pop it again. */
  push: (scope: UndoRedoScope) => () => void;
};

export const undoRedoScopeContext = createContext<UndoRedoScopeContextValue | undefined>(
  undefined,
);
