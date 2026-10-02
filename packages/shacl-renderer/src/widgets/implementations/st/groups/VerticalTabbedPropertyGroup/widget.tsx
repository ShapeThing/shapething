import { useContext } from "react";
import type { Term } from "@rdfjs/types";
import clsx from "clsx";
import { Icon } from "@iconify/react";
import EditUIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import ViewUIElementChildren from "@/outputs/render/modes/view/UIElementChildren.tsx";
import { verticalTabbedPropertyGroupContext } from "@/outputs/render/contexts/verticalTabbedPropertyGroupContext.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import {
  verticalTabbedGroupPanelId,
  verticalTabbedGroupTabId,
} from "@/structure/verticalTabbedGroups.ts";
import { iconifyDatatype } from "@/helpers/namespaces.ts";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { GroupWidgetProps } from "@/widgets/types.ts";
import "./style.css";

// st:icon is either a literal typed with the iconifyDatatype sentinel (an Iconify icon name, e.g.
// "mdi:home" - same convention as IconifyEditor/IconifyViewer) or anything else, treated as an
// image IRI/URL. There's no separate score.ttl-driven widget choice here (groups aren't scored,
// see registry.ts's getGroupWidget) - the tab nav itself picks between @iconify/react's <Icon/>
// and a plain <img> per tab, directly off each tab's own GroupUIElement.icon().
function isIconifyIconTerm(term: Term): boolean {
  return term.termType === "Literal" && term.datatype.equals(iconifyDatatype);
}

function TabIcon({ tab }: { tab: GroupUIElement }) {
  const icon = tab.icon();
  if (!icon) return null;
  return isIconifyIconTerm(icon) ? (
    <Icon icon={icon.value} className="st-vertical-tabbed-group-nav__icon" aria-hidden="true" />
  ) : (
    <img className="st-vertical-tabbed-group-nav__icon" src={icon.value} alt="" />
  );
}

// st:color here is a blank node carrying st:hue/st:saturation/st:lightness sibling triples (see
// GroupUIElement.color()) - resolved to a hex string once there, so this only has to hand it
// straight to a swatch's own background-color.
function TabColorSwatch({ tab }: { tab: GroupUIElement }) {
  const color = tab.color();
  if (!color) return null;
  return (
    <span
      className="st-vertical-tabbed-group-nav__color-swatch"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

/**
 * Drupal-style "vertical tabs": a column of tab buttons on the left (each optionally carrying its
 * own st:icon), the active tab's fields in a panel to the right. Unlike st:TabbedPropertyGroup -
 * whose nav and panel are stacked blocks that can afford to render from two different sibling
 * widget instances at two different points in the sibling sequence (see TabbedPropertyGroup) -
 * this layout needs the nav and the active panel to be literal DOM siblings inside one flex row,
 * so the whole nav+panel pair is rendered by a single instance: the first tab (lowest sh:order),
 * same as Tabbed picks for its own nav. Every other sibling tab's own widget instance renders
 * null - it still exists (so its GroupUIElement is discoverable via context/VerticalTabbedProperty
 * GroupFamily), it just never renders its own children directly; the first tab's instance pulls
 * whichever tab is active from `tabs` (shared via context) and renders that tab's own
 * label/description/children instead.
 */
export default function VerticalTabbedPropertyGroup({ group }: GroupWidgetProps) {
  const { mode } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { tabs, activeTabIri, setActiveTabIri } = useContext(verticalTabbedPropertyGroupContext);
  // Groups are selected by direct rdf:type match, with no separate edit/view registration (see
  // getGroupWidget) - so the one registered component has to pick which mode's UIElementChildren
  // recurses into its own children, rather than always hard-coding edit's.
  const UIElementChildren = mode === "view" ? ViewUIElementChildren : EditUIElementChildren;

  const isFirstTab = tabs[0]?.node.equals(group.node) ?? false;
  if (!isFirstTab) return null;

  const activeTab = tabs.find((tab) => tab.node.equals(activeTabIri)) ?? tabs[0];

  return (
    <div className="st-vertical-tabbed-group" data-iri={group.node.value}>
      <div
        className="st-vertical-tabbed-group-nav"
        role="tablist"
        aria-orientation="vertical"
      >
        {tabs.map((tab) => {
          const active = tab.node.equals(activeTab.node);
          const description = tab.description([activeInterfaceLanguage]);
          return (
            <button
              key={tab.node.value}
              type="button"
              role="tab"
              id={verticalTabbedGroupTabId(tab.node)}
              aria-selected={active}
              aria-controls={verticalTabbedGroupPanelId(tab.node)}
              className={clsx(
                "st-button",
                "st-vertical-tabbed-group-nav__tab",
                active && "st-button--primary",
              )}
              onClick={() => setActiveTabIri(tab.node)}
            >
              <TabColorSwatch tab={tab} />
              <TabIcon tab={tab} />
              <span className="st-vertical-tabbed-group-nav__label">
                {tab.label([activeInterfaceLanguage]) ?? tab.node.value}
                {description && <p className="st-property-group__description">{description}</p>}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="st-property-group st-vertical-tabbed-group__panel"
        role="tabpanel"
        id={verticalTabbedGroupPanelId(activeTab.node)}
        aria-labelledby={verticalTabbedGroupTabId(activeTab.node)}
        data-iri={activeTab.node.value}
      >
        <div className="st-property-group__body">
          <UIElementChildren key={activeTab.node.value} elements={activeTab.children} />
        </div>
      </div>
    </div>
  );
}
