import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { Plus } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { Localized } from "@fluent/react";

export default function PropertyUIComponentAdd({
  propertyUIElement,
}: {
  propertyUIElement: PropertyUIElement;
}) {
  const { contentLanguage } = useEnvironment();
  const existingObjects = useDataGraphObjects(propertyUIElement);
  const maxCount = parseFloat(propertyUIElement.getOne(sh("maxCount"))?.value ?? "Infinity");
  const canAddValue = maxCount > 1 && existingObjects.length < maxCount;

  const addValue = async () => {
    const term = await propertyUIElement.getDefaultObject(contentLanguage);
    if (term) propertyUIElement.addObject(term);
  };

  if (!canAddValue) return null;

  return (
    <Localized id="property-add-value" attrs={{ "aria-label": true }}>
      <button type="button" aria-label="Add value" onClick={addValue}>
        <Plus />
      </button>
    </Localized>
  );
}
