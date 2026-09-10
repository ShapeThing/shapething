import { useState, type ReactNode } from "react";
import type { Term } from "@rdfjs/types";
import clsx from "clsx";
import { tabbedPropertyGroupContext } from "@/outputs/render/contexts/tabbedPropertyGroupContext.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import {
  isTabbedPropertyGroup,
  tabbedGroupPanelId,
  tabbedGroupTabId,
} from "@/structure/tabbedGroups.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import "./style.css";

/**
 * Wraps one UIElementChildren list (one sibling level - the top of a node, or inside a plain group
 * like st:CollapsiblePropertyGroup) so every st:TabbedPropertyGroup sibling found in it shares one
 * "which tab is active" state and one <button role="tab"> nav, rendered once above the list -
 * exactly one sh:PropertyGroup subtype's DOM ever shows at a time, the rest render nothing (see the
 * widget itself). A list with no tabbed siblings renders `children` completely unchanged, which
 * covers every other list in the codebase, so this must stay a no-op then.
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
  const { activeInterfaceLanguage } = useInterfaceLanguage();
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
    <tabbedPropertyGroupContext.Provider value={{ activeTabIri, setActiveTabIri: setPinnedTabIri }}>
      <div className="st-tabbed-group-nav" role="tablist">
        {tabs.map((tab) => {
          const active = tab.node.equals(activeTabIri);
          return (
            <button
              key={tab.node.value}
              type="button"
              role="tab"
              id={tabbedGroupTabId(tab.node)}
              aria-selected={active}
              aria-controls={tabbedGroupPanelId(tab.node)}
              className={clsx("st-button", active && "st-button--primary")}
              onClick={() => setPinnedTabIri(tab.node)}
            >
              {tab.label([activeInterfaceLanguage]) ?? tab.node.value}
            </button>
          );
        })}
      </div>
      {children}
    </tabbedPropertyGroupContext.Provider>
  );
}
