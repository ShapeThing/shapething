import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { Plus } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { Localized } from "@fluent/react";

export default function PropertyUIComponentAdd({
  propertyUIElement,
  setShowEmptyWidget,
  showEmptyWidget,
}: {
  propertyUIElement: PropertyUIElement;
  showEmptyWidget: boolean;
  setShowEmptyWidget: (show: boolean) => void;
}) {
  const existingObjects = useDataGraphObjects(propertyUIElement);
  const maxCount = parseFloat(propertyUIElement.getOne(sh("maxCount"))?.value ?? "Infinity");
  const canAddValue = maxCount > 1 && existingObjects.length < maxCount && !showEmptyWidget;

  if (!canAddValue) return null;

  return (
    <Localized id="property-add-value" attrs={{ "aria-label": true }}>
      <button type="button" aria-label="Add value" onClick={() => setShowEmptyWidget(true)}>
        <Plus />
      </button>
    </Localized>
  );
}
