import { useSlotResolution } from "@/outputs/render/hooks/useSlotResolution.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { usePropertyValidationResults } from "@/outputs/render/hooks/usePropertyValidationResults.tsx";
import PropertyUIComponentRemove from "@/outputs/render/modes/edit/PropertyUIComponentRemove.tsx";
import WidgetSlot from "@/outputs/render/modes/edit/WidgetSlot.tsx";
import ResultMessages from "@/outputs/render/components/ValidationMessages/ResultMessages.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { useCallback } from "react";
import "./style.css";
import { shui } from "@/helpers/namespaces.ts";
import { worstSeverity } from "@/helpers/worstSeverity.ts";
import { termHueStyle } from "@/helpers/termHue.ts";

export default function PropertyUIComponentObject({
  propertyUIElement,
  object,
  labelledBy,
  onReplace,
  onTermSet,
  onRemove,
  autoFocus,
  alwaysShowRemove,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  labelledBy: string;
  onReplace: (oldTerm: Term, newTerm: Term) => void;
  onTermSet: () => void;
  onRemove: () => void;
  autoFocus?: boolean;
  // See PropertyUIComponentRemove's alwaysShow.
  alwaysShowRemove?: boolean;
}) {
  const setTerm = useCallback(
    (newTerm: Term) => {
      // Before the write, so the caller's display-order tracking already reflects the swap by
      // the time that write's re-render reads it (see PropertyUIComponentValues.reconcileOrder).
      onReplace(object, newTerm);
      propertyUIElement.replaceObject(object, newTerm);
      onTermSet();
    },
    [propertyUIElement, object, onReplace, onTermSet],
  );

  // A value also present in readOnlyGraph (e.g. an inferred triple) can't be removed through the
  // form - its remove button still renders (see below), just disabled, rather than disappearing -
  // see WidgetSlot's own identical check, which is what actually swaps its widget.
  const { readOnlyGraph } = useEnvironment();
  const isReadOnly = readOnlyGraph ? propertyUIElement.isReadOnly(object, readOnlyGraph) : false;

  // Same (propertyUIElement, object) resolution WidgetSlot itself runs below (same arguments, so
  // the same react-query key - one real resolution, not two), just for the meta this component
  // needs for PropertyUIComponentRemove's clearAll. WidgetSlot only diverges from this key while a
  // LogicalConstraintSwitcher pick is pinned, and its sub-queries are shared even then.
  const { meta } = useSlotResolution(propertyUIElement, object, {
    widgetPredicate: isReadOnly ? shui("viewer") : shui("editor"),
  });

  // Only the results attributed to this specific value (e.g. sh:pattern/sh:datatype) -
  // property-wide results (e.g. sh:minCount) are shown once, at the property level, by
  // PropertyUIComponent instead.
  const valueResults = usePropertyValidationResults(propertyUIElement, { value: object });
  // Scoped to just this value's own input (see FormElement/style.css) - a property-wide result
  // (e.g. sh:maxCount, with no `value`) never lands in valueResults, so it can't bleed its
  // severity onto a sibling value's input that isn't itself invalid.
  const severity = worstSeverity(valueResults);

  return (
    <div className="st-property-object-wrapper" style={termHueStyle(object)}>
      {/* Above the whole row rather than inside .st-property-object-main, so the remove button
          stays level with the input instead of with the message. */}
      <ResultMessages className="st-validation-messages--value" results={valueResults} />
      <div className="st-property-object" data-severity={severity}>
        <div className="st-property-object-main">
          <WidgetSlot
            propertyUIElement={propertyUIElement}
            object={object}
            labelledBy={labelledBy}
            setTerm={setTerm}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- widget prop, only set for a value the user just added
            autoFocus={autoFocus}
          />
        </div>
        {!meta?.hideRemoveButton && (
          <PropertyUIComponentRemove
            onRemove={onRemove}
            propertyUIElement={propertyUIElement}
            object={object}
            clearAll={meta?.singleUnifiedWidget?.(propertyUIElement) === true}
            disabled={isReadOnly}
            alwaysShow={alwaysShowRemove}
          />
        )}
      </div>
    </div>
  );
}
