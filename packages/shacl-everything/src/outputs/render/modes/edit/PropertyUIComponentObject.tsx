import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { usePropertyValidationResults } from "@/outputs/render/hooks/usePropertyValidationResults.tsx";
import PropertyUIComponentRemove from "@/outputs/render/modes/edit/PropertyUIComponentRemove.tsx";
import WidgetSlot from "@/outputs/render/modes/edit/WidgetSlot.tsx";
import ValidationMessages from "@/outputs/render/components/ValidationMessages/index.tsx";
import language, { configuredLanguages } from "@/resolution/language.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { useCallback } from "react";
import "./style.css";
import { localName } from "@/helpers/localName.ts";
import { shui } from "@/helpers/namespaces.ts";
import { worstSeverity } from "@/helpers/worstSeverity.ts";

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

  const { activeInterfaceLanguage } = useInterfaceLanguage();
  // sh:message is chrome (like sh:name/sh:description), so it's resolved the same way - one
  // best-matching language-tagged literal, not every language variant concatenated together.
  const messageLanguages = configuredLanguages(propertyUIElement.shapesGraph, [
    activeInterfaceLanguage,
  ]);

  // Same (propertyUIElement, object) query WidgetSlot itself resolves below, cached by
  // react-query under the same key - this doesn't cost a second real resolution, just the meta
  // this component needs for PropertyUIComponentRemove's clearAll (see PropertyUIComponent's own
  // similar early useWidget() call for the same "warm/reuse the cache" reasoning).
  const { meta } = useWidget(shui("editor"), propertyUIElement, object) ?? {};

  // Only the results attributed to this specific value (e.g. sh:pattern/sh:datatype) -
  // property-wide results (e.g. sh:minCount) are shown once, at the property level, by
  // PropertyUIComponent instead.
  const valueResults = usePropertyValidationResults(propertyUIElement).filter((result) =>
    result.value?.equals(object),
  );
  // Scoped to just this value's own input (see FormElement/style.css) - a property-wide result
  // (e.g. sh:maxCount, with no `value`) never lands in valueResults, so it can't bleed its
  // severity onto a sibling value's input that isn't itself invalid.
  const severity = worstSeverity(valueResults);

  return (
    <div className="st-property-object-wrapper">
      <div className="st-property-object" data-severity={severity}>
        <div className="st-property-object-main">
          <WidgetSlot
            propertyUIElement={propertyUIElement}
            object={object}
            labelledBy={labelledBy}
            setTerm={setTerm}
          />

          <ValidationMessages
            messages={valueResults.map((result) => ({
              severity: localName(result.severity) ?? "Violation",
              message: result.message.length
                ? language(result.message, messageLanguages).value
                : "",
            }))}
          />
        </div>
        <PropertyUIComponentRemove
          onRemove={onRemove}
          propertyUIElement={propertyUIElement}
          object={object}
          clearAll={meta?.singleUnifiedWidget?.(propertyUIElement) === true}
        />
      </div>
    </div>
  );
}
