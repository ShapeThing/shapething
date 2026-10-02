import { useState, type ReactNode } from "react";
import type { Term } from "@rdfjs/types";
import { tabbedPropertyGroupContext } from "@/outputs/render/contexts/tabbedPropertyGroupContext.tsx";
import { isTabbedPropertyGroup } from "@/structure/tabbedGroups.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * Wraps one UIElementChildren list (one sibling level - the top of a node, or inside a plain group
 * like st:CollapsiblePropertyGroup) so every st:TabbedPropertyGroup sibling found in it shares one
 * "which tab is active" state and one shared `tabs` list, provided via context - it renders no nav
 * markup of its own. The first tab (lowest sh:order) always renders the shared <button role="tab">
 * nav (over every tab in `tabs`, not just itself), regardless of whether it's the active one, so the
 * nav's DOM stays mounted continuously across tab switches rather than unmounting/remounting from a
 * different widget instance on every click (see the TabbedPropertyGroup widget for why that matters
 * - it would otherwise drop focus off the very button just clicked). The active tab's own panel is
 * rendered separately by whichever widget instance is currently active. Either way this still lands
 * at that group's own place in the sh:order-sorted sibling sequence - instead of the nav being
 * hoisted above the whole list regardless of where the tab groups themselves sort. Every sibling
 * that is neither the first tab nor the active one still renders nothing. A list with no tabbed
 * siblings renders `children` completely unchanged, which covers every other list in the codebase,
 * so this must stay a no-op then.
 *
 * Shared, mode-agnostic like GroupUIElementComponent (see UIElementChildren's own doc comment) -
 * kept under modes/edit/ and imported directly by modes/view/UIElementChildren.tsx rather than
 * duplicated, since which tab is active is a display choice with no edit-vs-view distinction of
 * its own.
 */
export default function TabbedPropertyGroupFamily({
  elements,
  children,
}: {
  elements: (PropertyUIElement | ChoiceElement | GroupUIElement)[];
  children: ReactNode;
}) {
  const tabs = elements.filter(
    (element): element is GroupUIElement =>
      element.kind === "group" && isTabbedPropertyGroup(element.node, element.shapesGraph),
  );

  // A manual pick always wins once made; it only falls back to the first tab (by sh:order -
  // `elements` is already sorted that way, see groupChildren.ts) before the user has touched the
  // nav, or once that pick no longer belongs to this exact family - same pin-with-fallback idiom as
  // ChoiceElementComponent's pinnedBranchKey.
  const [pinnedTabIri, setPinnedTabIri] = useState<Term | undefined>(undefined);

  if (tabs.length === 0) return <>{children}</>;

  const activeTabIri = tabs.some((tab) => tab.node.equals(pinnedTabIri))
    ? pinnedTabIri
    : tabs[0].node;

  return (
    <tabbedPropertyGroupContext.Provider
      value={{ tabs, activeTabIri, setActiveTabIri: setPinnedTabIri }}
    >
      {children}
    </tabbedPropertyGroupContext.Provider>
  );
}
