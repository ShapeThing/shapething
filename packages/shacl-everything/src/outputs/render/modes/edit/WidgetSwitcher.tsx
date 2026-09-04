import { useId } from "react";
import type { NamedNode, Term } from "@rdfjs/types";
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
  valueNode,
}: {
  activeWidgetIri: NamedNode | undefined;
  setActiveWidget: (iri: NamedNode, widget: () => WidgetComponent | undefined) => void;
  shape: PropertyUIElement;
  // The property's actual current value - threaded through to useWidgets so a widget only
  // reachable via a value-only shui:WidgetScore rule (shui:dataGraphShape with no
  // shui:shapesGraphShape - see score.ts's match()) still appears as a candidate here, matching
  // how WidgetSlot itself resolves the active widget (useWidget(..., object)). Without this, such
  // a widget can become active but never show up in this list, and the trigger/option falls back
  // to rendering the raw widget IRI instead of its label (see renderTriggerContent/renderOption).
  valueNode?: Term;
}) {
  const { enableWidgetSwitching } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const selectId = useId();

  const widgets = useWidgets(shui("editor"), shape, valueNode);

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
