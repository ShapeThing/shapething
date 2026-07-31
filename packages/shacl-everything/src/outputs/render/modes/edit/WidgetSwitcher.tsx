import { shui } from "@/helpers/namespaces.ts";
import { useWidgets } from "@/outputs/render/hooks/useWidgets.tsx";
import { propertyLabel } from "@/resolution/label.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { WidgetComponent } from "@/widgets/types.ts";
import { Localized } from "@fluent/react";

export default function WidgetSwitcher({
  ActiveWidget,
  setActiveWidget,
  shape,
}: {
  ActiveWidget: WidgetComponent | undefined;
  setActiveWidget: (widget: () => WidgetComponent | undefined) => void;
  shape: PropertyUIElement;
}) {
  const widgets = useWidgets(shui("editor"), shape);
  const activeWidgetIri = ActiveWidget
    ? widgets.find(({ Widget }) => Widget === ActiveWidget)?.iri
    : undefined;

  return widgets.length > 1 ? (
    <div className="st-widget-switcher">
      <label className="st-label">
        <Localized id="widget-switcher-label">Pick a widget</Localized>
      </label>
      <span className="st-select-wrapper st-select-wrapper-small">
        <select
          className="st-select"
          value={activeWidgetIri?.value ?? ""}
          onChange={(e) => {
            setActiveWidget(() => widgets.find(({ iri }) => iri.value === e.target.value)?.Widget);
          }}
        >
          {widgets.map(({ iri }) => {
            const widgetLabel = propertyLabel({ widget: iri, propertyShape: shape });

            return (
              <option key={iri.value} value={iri.value}>
                {widgetLabel}
              </option>
            );
          })}
        </select>
        <span className="st-select-arrow" aria-hidden="true" />
      </span>
    </div>
  ) : null;
}
