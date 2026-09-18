import { useState, type ReactNode } from "react";
import type { Term } from "@rdfjs/types";
import { verticalTabbedPropertyGroupContext } from "@/outputs/render/contexts/verticalTabbedPropertyGroupContext.tsx";
import { isVerticalTabbedPropertyGroup } from "@/structure/verticalTabbedGroups.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * Wraps one UIElementChildren list so every st:VerticalTabbedPropertyGroup sibling found in it
 * shares one "which tab is active" state and one shared `tabs` list, provided via context - same
 * pin-with-fallback idiom as TabbedPropertyGroupFamily. Unlike that one, this family renders no
 * nav of its own for the widget to pick apart by "first tab" vs "active tab": the whole nav+panel
 * pair is rendered by a single widget instance (see the VerticalTabbedPropertyGroup widget) since
 * a Drupal-style vertical-tabs layout needs the nav and the active panel to be literal DOM
 * siblings inside one flex row, not stacked blocks that can tolerate rendering from two different
 * instances at two different points in the sibling sequence (that's what TabbedPropertyGroup's
 * stacked layout could get away with). A list with no vertical-tabbed siblings renders `children`
 * completely unchanged, which covers every other list in the codebase, so this must stay a no-op
 * then.
 *
 * Shared, mode-agnostic like GroupUIElementComponent/TabbedPropertyGroupFamily - kept under
 * modes/edit/ and imported directly by modes/view/UIElementChildren.tsx rather than duplicated,
 * since which tab is active is a display choice with no edit-vs-view distinction of its own.
 */
export default function VerticalTabbedPropertyGroupFamily({
  elements,
  children,
}: {
  elements: (PropertyUIElement | ChoiceElement | GroupUIElement)[];
  children: ReactNode;
}) {
  const tabs = elements.filter(
    (element): element is GroupUIElement =>
      element.kind === "group" && isVerticalTabbedPropertyGroup(element.node, element.shapesGraph),
  );

  const [pinnedTabIri, setPinnedTabIri] = useState<Term | undefined>(undefined);

  if (tabs.length === 0) return <>{children}</>;

  const activeTabIri = tabs.some((tab) => tab.node.equals(pinnedTabIri))
    ? pinnedTabIri
    : tabs[0].node;

  return (
    <verticalTabbedPropertyGroupContext.Provider
      value={{ tabs, activeTabIri, setActiveTabIri: setPinnedTabIri }}
    >
      {children}
    </verticalTabbedPropertyGroupContext.Provider>
  );
}
