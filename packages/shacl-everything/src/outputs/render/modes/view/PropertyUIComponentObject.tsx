import type { Term } from "@rdfjs/types";
import WidgetSlot from "@/outputs/render/modes/view/WidgetSlot.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

export default function PropertyUIComponentObject({
  propertyUIElement,
  object,
  labelledBy,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  labelledBy: string;
}) {
  return (
    <div className="st-property-object-wrapper">
      <div className="st-property-object">
        <div className="st-property-object-main">
          <WidgetSlot
            propertyUIElement={propertyUIElement}
            object={object}
            labelledBy={labelledBy}
          />
        </div>
      </div>
    </div>
  );
}
