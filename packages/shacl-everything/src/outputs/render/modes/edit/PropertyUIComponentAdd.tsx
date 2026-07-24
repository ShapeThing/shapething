import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { Plus } from "@/helpers/icons.tsx";
import { sh, shui } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { Localized } from "@fluent/react";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";

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
  let canAddValue = maxCount > 1 && existingObjects.length < maxCount && !showEmptyWidget;
  const { meta } = useWidget(shui("editor"), propertyUIElement) ?? {};

  if (meta?.canAddMore) {
    const canAddMore = meta.canAddMore(propertyUIElement);
    if (canAddMore === false) canAddValue = false;
  }

  if (!canAddValue) return null;

  return (
    <Localized id="property-add-value" attrs={{ "aria-label": true }}>
      <button type="button" aria-label="Add value" onClick={() => setShowEmptyWidget(true)}>
        <Plus />
      </button>
    </Localized>
  );
}
