import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { Minus } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { severityFromTerm } from "@/helpers/severityFromTerm.ts";
import { clsx } from "clsx";

/**
 * A component that renders a button to remove a value from a property UI element, if allowed.
 *
 * Use cases to consider:
 * - A property with a minCount of 1 should not show a clear icon if it has only one value
 */
export default function PropertyUIComponentRemove({
  propertyUIElement,
  object,
  onRemove,
  clearAll = false,
  disabled = false,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  onRemove: () => void;
  // A singleUnifiedWidget (see widgets/types.ts) is the property's only instance, showing every
  // value at once rather than just `object` - so its "-" clears the whole set instead of the one
  // value this instance happens to have been handed.
  clearAll?: boolean;
  // True for a value also present in Environment.readOnlyGraph (see PropertyUIElement.isReadOnly()
  // / outputs/render/modes/edit/WidgetSlot.tsx) - unlike hardBlockedByMinCount below, this still
  // renders the button (so the row's layout matches its editable siblings) but disables it, since
  // an inferred/read-only triple can't be removed through the form.
  disabled?: boolean;
}) {
  const existingObjects = useDataGraphObjects(propertyUIElement);
  const minCount = propertyUIElement.get(sh("minCount")) ?? 0;
  const minCountReached = !(minCount === 0 || existingObjects.length > minCount);
  const severity = severityFromTerm(propertyUIElement.get(sh("severity")));

  // sh:minCount only hard-blocks removal at its default/explicit sh:Violation severity - the
  // button isn't rendered at all in that case (mirrors PropertyUIComponentAdd's
  // hardBlockedByMaxCount), rather than shown disabled - a permanently-disabled control (e.g. a
  // required single value) is just noise the user learns to ignore. A Warning or Info severity
  // still lets the user remove past it, relying on validation to flag the result afterwards
  // instead of blocking the action outright. `disabled` (read-only values) overrides this hiding -
  // that case is shown-but-disabled instead, not hidden.
  const hardBlockedByMinCount = minCountReached && (severity === undefined || severity === "error");

  const removeValue = () => {
    if (clearAll) {
      for (const existing of [...propertyUIElement.getObjects()]) {
        propertyUIElement.removeObject(existing);
      }
    } else {
      propertyUIElement.removeObject(object);
    }
    onRemove();
  };

  return (
    (disabled || !hardBlockedByMinCount) && (
      <Localized id="property-remove-value" attrs={{ "aria-label": true }}>
        <button
          className={clsx(
            "st-button",
            minCountReached && severity && ["st-button--severity", `severity-${severity}`],
          )}
          type="button"
          aria-label="Remove value"
          disabled={disabled}
          onClick={removeValue}
        >
          <Minus />
        </button>
      </Localized>
    )
  );
}
