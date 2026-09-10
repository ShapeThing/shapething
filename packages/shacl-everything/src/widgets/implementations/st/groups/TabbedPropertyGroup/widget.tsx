import { useContext } from "react";
import EditUIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import ViewUIElementChildren from "@/outputs/render/modes/view/UIElementChildren.tsx";
import { tabbedPropertyGroupContext } from "@/outputs/render/contexts/tabbedPropertyGroupContext.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { tabbedGroupPanelId, tabbedGroupTabId } from "@/structure/tabbedGroups.ts";
import type { GroupWidgetProps } from "@/widgets/types.ts";

export default function TabbedPropertyGroup({ group }: GroupWidgetProps) {
  const { mode } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { activeTabIri } = useContext(tabbedPropertyGroupContext);
  const description = group.description([activeInterfaceLanguage]);
  // Groups are selected by direct rdf:type match, with no separate edit/view registration (see
  // getGroupWidget) - so the one registered component has to pick which mode's UIElementChildren
  // recurses into its own children, rather than always hard-coding edit's.
  const UIElementChildren = mode === "view" ? ViewUIElementChildren : EditUIElementChildren;

  // TabbedPropertyGroupFamily (see UIElementChildren) renders the shared tab nav above this whole
  // list and decides which sibling tab is active; every other sibling in the same family stays
  // mounted but renders nothing here - the nav button is already this group's own label, so there's
  // no separate title to show once its panel is showing.
  if (!activeTabIri?.equals(group.node)) return null;

  return (
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
  );
}
