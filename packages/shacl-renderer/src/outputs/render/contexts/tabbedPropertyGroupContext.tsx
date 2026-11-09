import type { Term } from "@rdfjs/types";
import { createContext } from "react";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";

export type TabbedPropertyGroupContextValue = {
  activeTabIri: Term | undefined;
  setActiveTabIri: (tab: Term | undefined) => void;
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

/**
 * ShaclRenderer's `activeTab`/`onTabChange`: the st:TabbedPropertyGroup an embedder shows (its IRI),
 * e.g. kept in its URL, and what to call when the user picks another. A tab the renderer does not
 * show (no such group, or one without content) falls back to the first one.
 */
export type TabSelection = {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
};

export const tabSelectionContext = createContext<TabSelection>({});
