import type { Term } from "@rdfjs/types";
import { createContext, type Dispatch, type SetStateAction } from "react";

export type TabbedPropertyGroupContextValue = {
  activeTabIri: Term | undefined;
  setActiveTabIri: Dispatch<SetStateAction<Term | undefined>>;
};

// A concrete default (not undefined/throwing) - same convention as memberShapeTableContext:
// "no TabbedPropertyGroupFamily above me" and "nothing active" are the same state, so the
// st:TabbedPropertyGroup widget can read this unconditionally (including when rendered directly in
// a test, outside any family) rather than needing a hook that throws outside a provider.
export const tabbedPropertyGroupContext = createContext<TabbedPropertyGroupContextValue>({
  activeTabIri: undefined,
  setActiveTabIri: () => {},
});
