import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import PropertyUIComponentRemove from "@/outputs/render/modes/edit/PropertyUIComponentRemove.tsx";
import WidgetSlot from "@/outputs/render/modes/edit/WidgetSlot.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { useCallback } from "react";
import "./style.css";
import { shui } from "@/helpers/namespaces.ts";

export default function PropertyUIComponentObject({
  propertyUIElement,
  object,
  labelledBy,
  onTermSet,
  onRemove,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  labelledBy: string;
  onTermSet: () => void;
  onRemove: () => void;
}) {
  const setTerm = useCallback(
    (newTerm: Term) => {
      propertyUIElement.replaceObject(object, newTerm);
      onTermSet();
    },
    [propertyUIElement, object, onTermSet],
  );

  // Same (propertyUIElement, object) query WidgetSlot itself resolves below, cached by
  // react-query under the same key - this doesn't cost a second real resolution, just the meta
  // this component needs for PropertyUIComponentRemove's clearAll (see PropertyUIComponent's own
  // similar early useWidget() call for the same "warm/reuse the cache" reasoning).
  const { meta } = useWidget(shui("editor"), propertyUIElement, object) ?? {};

  return (
    <div className="st-property-object">
      <WidgetSlot
        propertyUIElement={propertyUIElement}
        object={object}
        labelledBy={labelledBy}
        setTerm={setTerm}
      />
      <PropertyUIComponentRemove
        onRemove={onRemove}
        propertyUIElement={propertyUIElement}
        object={object}
        clearAll={meta?.singleUnifiedWidget?.(propertyUIElement) === true}
      />
    </div>
  );
}
