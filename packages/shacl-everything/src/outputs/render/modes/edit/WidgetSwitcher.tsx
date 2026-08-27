import { useId } from "react";
import type { NamedNode } from "@rdfjs/types";
import { shui } from "@/helpers/namespaces.ts";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useWidgets } from "@/outputs/render/hooks/useWidgets.tsx";
import { propertyLabel } from "@/resolution/label.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { WidgetComponent } from "@/widgets/types.ts";
import { Localized } from "@fluent/react";

export default function WidgetSwitcher({
  activeWidgetIri,
  setActiveWidget,
  shape,
}: {
  activeWidgetIri: NamedNode | undefined;
  setActiveWidget: (iri: NamedNode, widget: () => WidgetComponent | undefined) => void;
  shape: PropertyUIElement;
}) {
  const { enableWidgetSwitching } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const selectId = useId();

  const widgets = useWidgets(shui("editor"), shape);

  return enableWidgetSwitching ? (
    <FormElement
      className="st-widget-switcher"
      size="small"
      label={<Localized id="widget-switcher-label">Pick a widget</Localized>}
      tooltip={<Localized id="widget-switcher-tooltip" />}
      htmlFor={selectId}
    >
      <SelectListbox
        triggerId={selectId}
        value={activeWidgetIri?.value ?? ""}
        options={widgets.map(({ iri }) => iri.value)}
        onChange={(v) => {
          const found = widgets.find(({ iri }) => iri.value === v);
          if (found) setActiveWidget(found.iri as NamedNode, () => found.Widget);
        }}
        renderTriggerContent={(v) => {
          const w = widgets.find(({ iri }) => iri.value === v);
          if (!w) return v;
          return `${propertyLabel({ term: w.iri, propertyShape: shape, languages: [activeInterfaceLanguage] })} (${w.score})`;
        }}
        renderOption={(v) => {
          const w = widgets.find(({ iri }) => iri.value === v);
          if (!w) return v;
          return `${propertyLabel({ term: w.iri, propertyShape: shape, languages: [activeInterfaceLanguage] })} (${w.score})`;
        }}
        wrapperClassName="st-select-wrapper-small"
      />
    </FormElement>
  ) : null;
}
