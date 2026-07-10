import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

type PropertyUIComponentProps = {
  propertyUIElement: PropertyUIElement;
};

export default function PropertyUIComponent({ propertyUIElement }: PropertyUIComponentProps) {
  const Widget = useWidget(propertyUIElement);

  return (
    <FormElement label={propertyUIElement.label()?.value}>
      {Widget && <Widget node={propertyUIElement} />}
    </FormElement>
  );
}
