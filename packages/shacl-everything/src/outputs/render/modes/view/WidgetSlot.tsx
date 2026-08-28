import type { Term } from "@rdfjs/types";
import { useMemo } from "react";
import { sh, shui } from "@/helpers/namespaces.ts";
import { useActiveBranch } from "@/outputs/render/hooks/useActiveBranch.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import { logicalBranches, withBranch } from "@/structure/logicalBranches.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

// Viewers never write back, but WidgetComponent's props always include setTerm - a no-op keeps
// every viewer implementation exactly as simple as the shape it renders, with nothing to guard.
const noop = () => {};

/**
 * The view-mode counterpart to edit mode's WidgetSlot: resolves and renders whichever
 * shui:viewer currently scores highest for `(propertyUIElement, object)`, including sh:or/sh:xone
 * branch detection (a value's active branch still changes which constraints - and so which
 * viewer - apply, even though there's nothing here to switch manually). Unlike edit mode there is
 * no fly-out, no widget-switcher, and no held-over ActiveWidget state to avoid disrupting mid-edit
 * focus - a resolved widget change here just re-renders, since nothing the user is doing can be
 * interrupted by it.
 */
export default function WidgetSlot({
  propertyUIElement,
  object,
  labelledBy,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  labelledBy: string;
}) {
  const branches = useMemo(() => logicalBranches(propertyUIElement), [propertyUIElement]);
  const detectedBranch = useActiveBranch(propertyUIElement, object, branches);
  const effectiveProperty = detectedBranch
    ? withBranch(propertyUIElement, detectedBranch.shape)
    : propertyUIElement;

  const { Widget } = useWidget(shui("viewer"), effectiveProperty, object) ?? {};
  const unit = propertyUIElement.get(sh("unit"))[0]?.value;

  if (!Widget) return null;

  return (
    <>
      <div className="st-property-object__widget" data-widget={Widget.name}>
        <Widget shape={effectiveProperty} term={object} setTerm={noop} labelledBy={labelledBy} />
      </div>
      {unit && <span className="st-property-object__unit">{unit}</span>}
    </>
  );
}
