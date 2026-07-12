import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { Minus } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { Localized } from "@fluent/react";

export default function PropertyUIComponentRemove({
  propertyUIElement,
  object,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
}) {
  const existingObjects = useDataGraphObjects(propertyUIElement);
  const minCount = parseFloat(propertyUIElement.getOne(sh("minCount"))?.value ?? "0");
  const canRemove = existingObjects.length > minCount;

  const removeValue = () => propertyUIElement.removeObject(object);

  if (!canRemove) return null;

  return (
    <Localized id="property-remove-value" attrs={{ "aria-label": true }}>
      <button type="button" aria-label="Remove value" onClick={removeValue}>
        <Minus />
      </button>
    </Localized>
  );
}
