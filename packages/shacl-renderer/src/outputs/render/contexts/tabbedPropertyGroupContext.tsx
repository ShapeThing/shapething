import type { Term } from "@rdfjs/types";
import { createContext, type Dispatch, type SetStateAction } from "react";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";

export type TabbedPropertyGroupContextValue = {
  activeTabIri: Term | undefined;
  setActiveTabIri: Dispatch<SetStateAction<Term | undefined>>;
  // The full sibling tab list, computed once by TabbedPropertyGroupFamily - every family member
  // needs it now, not just the family wrapper, since whichever tab is active is the one that
  // renders the shared nav (over every tab, not just itself) immediately before its own panel -
  // see the TabbedPropertyGroup widget.
  tabs: readonly GroupUIElement[];
};

// A concrete default (not undefined/throwing) - same convention as memberShapeTableContext:
// "no TabbedPropertyGroupFamily above me" and "nothing active" are the same state, so the
// st:TabbedPropertyGroup widget can read this unconditionally (including when rendered directly in
// a test, outside any family) rather than needing a hook that throws outside a provider.
export const tabbedPropertyGroupContext = createContext<TabbedPropertyGroupContextValue>({
  activeTabIri: undefined,
  setActiveTabIri: () => {},
  tabs: [],
});
