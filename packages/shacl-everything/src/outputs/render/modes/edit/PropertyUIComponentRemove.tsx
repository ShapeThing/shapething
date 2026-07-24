import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { Minus } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { Localized } from "@fluent/react";

/**
 * A component that renders a button to remove a value from a property UI element, if allowed.
 *
 * Use cases to consider:
 * - A checkbox should not show a clear icon
 * - A property with a minCount of 1 should not show a clear icon if it has only one value
 */
export default function PropertyUIComponentRemove({
  propertyUIElement,
  object,
  onRemove,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  onRemove: () => void;
}) {
  const existingObjects = useDataGraphObjects(propertyUIElement);
  const minCount = parseFloat(propertyUIElement.getOne(sh("minCount"))?.value ?? "0");
  const canRemove = existingObjects.length > minCount;

  const removeValue = () => {
    propertyUIElement.removeObject(object);
    onRemove();
  };

  if (!canRemove) return null;

  return (
    <Localized id="property-remove-value" attrs={{ "aria-label": true }}>
      <button type="button" aria-label="Remove value" onClick={removeValue}>
        <Minus />
      </button>
    </Localized>
  );
}
