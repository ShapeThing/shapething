import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import PropertyUIComponentRemove from "@/outputs/render/modes/edit/PropertyUIComponentRemove.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";

export default function PropertyUIComponentObject({
  propertyUIElement,
  object,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
}) {
  const Widget = useWidget(propertyUIElement);

  return (
    <>
      {Widget && <Widget shape={propertyUIElement} term={object} />}
      <PropertyUIComponentRemove propertyUIElement={propertyUIElement} object={object} />
    </>
  );
}
