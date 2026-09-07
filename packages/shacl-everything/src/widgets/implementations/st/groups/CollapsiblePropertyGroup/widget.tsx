import EditUIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import ViewUIElementChildren from "@/outputs/render/modes/view/UIElementChildren.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import type { GroupWidgetProps } from "@/widgets/types.ts";
import { Chevron } from "@/helpers/icons.tsx";

export default function CollapsiblePropertyGroup({ group }: GroupWidgetProps) {
  const { mode } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const label = group.label([activeInterfaceLanguage]);
  const description = group.description([activeInterfaceLanguage]);
  // Groups are selected by direct rdf:type match, with no separate edit/view registration (see
  // getGroupWidget) - so the one registered component has to pick which mode's UIElementChildren
  // recurses into its own children, rather than always hard-coding edit's.
  const UIElementChildren = mode === "view" ? ViewUIElementChildren : EditUIElementChildren;

  return (
    <details className="st-property-group" open>
      <summary className="st-property-group__title st-property-group__legend">
        <Chevron />
        {label}
      </summary>
      {description && <p className="st-property-group__description">{description}</p>}
      <div className="st-property-group__body">
        <UIElementChildren elements={group.children} />
      </div>
    </details>
  );
}
