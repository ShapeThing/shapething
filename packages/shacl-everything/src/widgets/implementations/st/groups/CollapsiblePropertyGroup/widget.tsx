import UIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import type { GroupWidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function CollapsiblePropertyGroup({ group }: GroupWidgetProps) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const label = group.label([activeInterfaceLanguage]);

  return (
    <details className="st-collapsible-property-group" open>
      <summary className="st-collapsible-property-group__title">{label}</summary>
      <div className="st-collapsible-property-group__body">
        <UIElementChildren elements={group.children} />
      </div>
    </details>
  );
}
