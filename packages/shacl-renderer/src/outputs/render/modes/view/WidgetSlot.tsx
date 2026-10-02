import type { Term } from "@rdfjs/types";
import { Suspense } from "react";
import { sh, shui } from "@/helpers/namespaces.ts";
import { Loading } from "@/helpers/icons.tsx";
import { localName } from "@/helpers/localName.ts";
import { termKey } from "@/helpers/termKey.ts";
import { useSlotResolution } from "@/outputs/render/hooks/useSlotResolution.tsx";
import WidgetErrorBoundary from "@/outputs/render/components/WidgetErrorBoundary/index.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

// Viewers never write back, but WidgetComponent's props always include setTerm - a no-op keeps
// every viewer implementation exactly as simple as the shape it renders, with nothing to guard.
const noop = () => {};

/**
 * The view-mode counterpart to edit mode's WidgetSlot: resolves and renders whichever
 * shui:viewer currently scores highest for `(propertyUIElement, object)`, including sh:or/sh:xone
 * branch detection (a value's active branch still changes which constraints - and so which
 * viewer - apply, even though there's nothing here to switch manually) - both in one query, see
 * useSlotResolution. Unlike edit mode there is no fly-out, no widget-switcher, and no held-over
 * ActiveWidget state to avoid disrupting mid-edit focus - a resolved widget change here just
 * re-renders, since nothing the user is doing can be interrupted by it.
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
  const { effectiveProperty, Widget, iri } = useSlotResolution(propertyUIElement, object, {
    widgetPredicate: shui("viewer"),
  });
  const unit = propertyUIElement.get(sh("unit"))[0]?.value;

  if (!Widget) return null;

  return (
    <>
      <div className="st-property-object__widget" data-widget={localName(iri)}>
        <WidgetErrorBoundary resetKeys={[termKey(object), iri?.value]} widget={iri?.value}>
          <Suspense fallback={<Loading />}>
            <Widget shape={effectiveProperty} term={object} setTerm={noop} labelledBy={labelledBy} />
          </Suspense>
        </WidgetErrorBoundary>
      </div>
      {unit && <span className="st-property-object__unit">{unit}</span>}
    </>
  );
}
