import EditUIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import ViewUIElementChildren from "@/outputs/render/modes/view/UIElementChildren.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import type { GroupWidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function PropertyGroup({ group }: GroupWidgetProps) {
  const { mode } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const label = group.label([activeInterfaceLanguage]);
  const description = group.description([activeInterfaceLanguage]);
  // Groups are selected by direct rdf:type match, with no separate edit/view registration (see
  // getGroupWidget) - so the one registered component has to pick which mode's UIElementChildren
  // recurses into its own children, rather than always hard-coding edit's.
  const UIElementChildren = mode === "view" ? ViewUIElementChildren : EditUIElementChildren;

  return (
    <fieldset className="st-property-group">
      <legend className="st-property-group__legend">
        <span className="st-property-group__title">{label}</span>
      </legend>
      <div className="st-property-group__body">
        {description && <p className="st-property-group__description">{description}</p>}

        <UIElementChildren elements={group.children} />
      </div>
    </fieldset>
  );
}
