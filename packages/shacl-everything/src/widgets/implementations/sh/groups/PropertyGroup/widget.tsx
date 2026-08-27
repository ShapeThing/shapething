import UIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import type { GroupWidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function PropertyGroup({ group }: GroupWidgetProps) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const label = group.label([activeInterfaceLanguage]);

  return (
    <fieldset className="st-property-group">
      <legend className="st-property-group__title">{label}</legend>
      <div className="st-property-group__body">
        <UIElementChildren elements={group.children} />
      </div>
    </fieldset>
  );
}
