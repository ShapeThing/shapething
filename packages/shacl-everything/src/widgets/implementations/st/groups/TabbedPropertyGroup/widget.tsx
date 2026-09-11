import { useContext } from "react";
import clsx from "clsx";
import EditUIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import ViewUIElementChildren from "@/outputs/render/modes/view/UIElementChildren.tsx";
import { tabbedPropertyGroupContext } from "@/outputs/render/contexts/tabbedPropertyGroupContext.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { tabbedGroupPanelId, tabbedGroupTabId } from "@/structure/tabbedGroups.ts";
import type { GroupWidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function TabbedPropertyGroup({ group }: GroupWidgetProps) {
  const { mode } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { tabs, activeTabIri, setActiveTabIri } = useContext(tabbedPropertyGroupContext);
  const description = group.description([activeInterfaceLanguage]);
  // Groups are selected by direct rdf:type match, with no separate edit/view registration (see
  // getGroupWidget) - so the one registered component has to pick which mode's UIElementChildren
  // recurses into its own children, rather than always hard-coding edit's.
  const UIElementChildren = mode === "view" ? ViewUIElementChildren : EditUIElementChildren;

  // TabbedPropertyGroupFamily (see UIElementChildren) only tracks which sibling tab is active and
  // hands every family member the same `tabs` list via context - it renders no markup of its own.
  // The shared <button role="tab"> nav (over every entry in `tabs`, not just this one) is always
  // rendered by the first tab (lowest sh:order) specifically - not by "whichever tab is active" -
  // so its DOM stays mounted continuously across tab switches instead of unmounting/remounting from
  // a different widget instance every click, which would otherwise drop focus off the very button
  // just clicked. The active tab's own panel is a separate, independently-gated block - so on the
  // (common) initial render, where the first tab is also the active one, both render from this same
  // instance as adjacent siblings; when some other tab is active, its own instance renders only the
  // panel, still landing right after the first tab's nav in the sh:order-sorted sibling sequence
  // (nothing else in between renders). tablist and tabpanel are kept as siblings rather than nested
  // (standard ARIA tabs authoring practice) - the nav button doubles as this group's own label, so
  // there's no separate title to show once its panel is showing. Every sibling that is neither the
  // first tab nor the active one still renders null.
  const isFirstTab = tabs[0]?.node.equals(group.node) ?? false;
  const isActiveTab = activeTabIri?.equals(group.node) ?? false;
  if (!isFirstTab && !isActiveTab) return null;

  return (
    <>
      {isFirstTab && (
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
                onClick={() => setActiveTabIri(tab.node)}
              >
                {tab.label([activeInterfaceLanguage]) ?? tab.node.value}
              </button>
            );
          })}
        </div>
      )}
      {isActiveTab && (
        <div
          className="st-property-group"
          role="tabpanel"
          id={tabbedGroupPanelId(group.node)}
          aria-labelledby={tabbedGroupTabId(group.node)}
        >
          {description && <p className="st-property-group__description">{description}</p>}
          <div className="st-property-group__body">
            <UIElementChildren elements={group.children} />
          </div>
        </div>
      )}
    </>
  );
}
