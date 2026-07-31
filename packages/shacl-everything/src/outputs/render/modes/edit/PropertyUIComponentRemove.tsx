import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { Minus } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import Tooltip from "@/outputs/render/components/Tooltip/index.tsx";
import type { Severity } from "@/types/severity.ts";

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
  const severity = propertyUIElement.getOne(sh("severity"))?.value as Severity | undefined;

  const removeValue = () => {
    debugger;
    propertyUIElement.removeObject(object);
    onRemove();
  };

  return (
    <Localized id="property-remove-value" attrs={{ "aria-label": true }}>
      <Tooltip enabled={!canRemove} severity={severity} tip={<Localized id="min-count-required" />}>
        <button
          disabled={!canRemove}
          className="st-button"
          type="button"
          aria-label="Remove value"
          onClick={removeValue}
        >
          <Minus />
        </button>
      </Tooltip>
    </Localized>
  );
}
