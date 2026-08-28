import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { Plus } from "@/helpers/icons.tsx";
import { sh, shui } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { Localized } from "@fluent/react";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import { severityFromTerm } from "@/helpers/severityFromTerm.ts";
import "./style.css";
import { clsx } from "clsx";

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
  const maxCount = propertyUIElement.get(sh("maxCount")) ?? Infinity;
  const minCount = propertyUIElement.get(sh("minCount")) ?? 0;
  const fieldIsSingleValued = maxCount === 1 && minCount <= 1;

  // Whether sh:maxCount itself stands in the way of adding another value - kept apart from
  // showEmptyWidget/meta.canAddMore below, which block for reasons that have nothing to do with
  // sh:maxCount (an already-open empty widget, a widget's own internal limit).
  const maxCountReached = !(maxCount > 1 && existingObjects.length < maxCount);
  const severity = severityFromTerm(propertyUIElement.get(sh("severity")));

  // sh:maxCount only hard-blocks at its default/explicit sh:Violation severity - the button isn't
  // rendered at all in that case. A Warning or Info severity still lets the user add past it (e.g.
  // a deprecated field they may still have a reason to override), relying on validation to flag
  // the result afterwards instead of blocking the action outright.
  const hardBlockedByMaxCount = maxCountReached && (severity === undefined || severity === "error");

  const disabled = showEmptyWidget;

  const { meta } = useWidget(shui("editor"), propertyUIElement) ?? {};
  const { enableCreateInPlace } = useEnvironment();

  // A widget's own "no more values possible" signal (e.g. InstancesSelectEditor once every
  // instance is already in use) is a hard, structural block like sh:maxCount above, not a
  // transient one like showEmptyWidget - so it hides the button too, rather than showing a
  // permanently-disabled control the user can't do anything about. But when enableCreateInPlace is
  // on, that widget offers its own always-visible "Create new" option once opened (see
  // InstancesSelectEditor/AutoCompleteEditor), so "no existing instances left to pick" is no longer
  // a dead end and shouldn't block adding another value at all.
  const noOptionsAvailable =
    !enableCreateInPlace && meta?.canAddMore?.(propertyUIElement) === false;

  return (
    !fieldIsSingleValued &&
    !hardBlockedByMaxCount &&
    !noOptionsAvailable && (
      <Localized id="property-add-value" attrs={{ "aria-label": true }}>
        <button
          disabled={disabled}
          className={clsx(
            "st-button",
            "st-property-add-button",
            maxCountReached && severity && ["st-button--severity", `severity-${severity}`],
          )}
          type="button"
          aria-label="Add value"
          onClick={() => setShowEmptyWidget(true)}
        >
          <Plus />
        </button>
      </Localized>
    )
  );
}
