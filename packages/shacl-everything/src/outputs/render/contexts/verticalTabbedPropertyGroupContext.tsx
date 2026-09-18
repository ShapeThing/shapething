import type { Term } from "@rdfjs/types";
import { createContext, type Dispatch, type SetStateAction } from "react";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";

export type VerticalTabbedPropertyGroupContextValue = {
  activeTabIri: Term | undefined;
  setActiveTabIri: Dispatch<SetStateAction<Term | undefined>>;
  // The full sibling tab list, computed once by VerticalTabbedPropertyGroupFamily - unlike
  // TabbedPropertyGroupFamily's own context, only the first tab's widget instance ever reads this
  // (it renders the whole nav+panel pair itself, see the widget), but it stays on the shared
  // context regardless, for the same "no family above me" concrete-default reasoning below.
  tabs: readonly GroupUIElement[];
};

// A concrete default (not undefined/throwing) - same convention as tabbedPropertyGroupContext:
// "no VerticalTabbedPropertyGroupFamily above me" and "nothing active" are the same state, so the
// st:VerticalTabbedPropertyGroup widget can read this unconditionally (including when rendered
// directly in a test, outside any family) rather than needing a hook that throws outside a
// provider.
export const verticalTabbedPropertyGroupContext =
  createContext<VerticalTabbedPropertyGroupContextValue>({
    activeTabIri: undefined,
    setActiveTabIri: () => {},
    tabs: [],
  });
