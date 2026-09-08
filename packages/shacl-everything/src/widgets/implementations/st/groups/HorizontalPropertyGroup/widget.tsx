import { useContext } from "react";
import EditPropertyUIComponent from "@/outputs/render/modes/edit/PropertyUIComponent.tsx";
import EditUIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import ViewUIElementChildren from "@/outputs/render/modes/view/UIElementChildren.tsx";
import { memberShapeTableContext } from "@/outputs/render/contexts/memberShapeTableContext.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { GroupWidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function HorizontalPropertyGroup({ group }: GroupWidgetProps) {
  const { mode } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  // Only ever true when this group is rendered inside a MemberShapeList row that collapsed into
  // a single header row above the whole list (see MemberShapeList's tableColumns) - that header
  // already carries this group's own label/legend and each column's field label once, so both
  // are suppressed here rather than repeated on every row.
  const { hideLabels, labelledByForColumn } = useContext(memberShapeTableContext);
  const label = group.label([activeInterfaceLanguage]);
  const description = group.description([activeInterfaceLanguage]);
  // Groups are selected by direct rdf:type match, with no separate edit/view registration (see
  // getGroupWidget) - so the one registered component has to pick which mode's UIElementChildren
  // recurses into its own children, rather than always hard-coding edit's.
  const UIElementChildren = mode === "view" ? ViewUIElementChildren : EditUIElementChildren;

  return (
    <fieldset className="st-property-group st-property-group--horizontal">
      {label && !hideLabels && (
        <legend className="st-property-group__legend">
          <span className="st-property-group__title">{label}</span>
        </legend>
      )}
      {description && <p className="st-property-group__description">{description}</p>}
      <div className="st-property-group__body">
        {hideLabels ? (
          // MemberShapeList only sets hideLabels once it has already confirmed every child of
          // this exact group is a plain property (see its tableColumns detection) - rendering
          // PropertyUIComponent directly for each is safe without re-checking `.kind` here.
          (group.children as PropertyUIElement[]).map((child, index) => (
            <EditPropertyUIComponent
              key={index}
              propertyUIElement={child}
              hideLabel
              labelledBy={labelledByForColumn(index)}
            />
          ))
        ) : (
          <UIElementChildren elements={group.children} />
        )}
      </div>
    </fieldset>
  );
}
