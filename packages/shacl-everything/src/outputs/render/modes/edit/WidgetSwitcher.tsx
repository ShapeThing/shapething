import { useId } from "react";
import { shui } from "@/helpers/namespaces.ts";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
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
  const { enableWidgetSwitching } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const selectId = useId();

  const widgets = useWidgets(shui("editor"), shape);
  const activeWidgetIri = ActiveWidget
    ? widgets.find(({ Widget }) => Widget === ActiveWidget)?.iri
    : undefined;

  return enableWidgetSwitching && widgets.length > 1 ? (
    <FormElement
      className="st-widget-switcher"
      size="small"
      label={<Localized id="widget-switcher-label">Pick a widget</Localized>}
      tooltip={<Localized id="widget-switcher-tooltip" />}
      htmlFor={selectId}
    >
      <span className="st-select-wrapper st-select-wrapper-small">
        <select
          id={selectId}
          className="st-select"
          value={activeWidgetIri?.value ?? ""}
          onChange={(e) => {
            setActiveWidget(() => widgets.find(({ iri }) => iri.value === e.target.value)?.Widget);
          }}
        >
          {widgets.map(({ iri, score }) => {
            const widgetLabel = propertyLabel({
              term: iri,
              propertyShape: shape,
              languages: [activeInterfaceLanguage],
            });

            return (
              <option key={iri.value} value={iri.value}>
                {widgetLabel} ({score})
              </option>
            );
          })}
        </select>
        <span className="st-select-arrow" aria-hidden="true" />
      </span>
    </FormElement>
  ) : null;
}
