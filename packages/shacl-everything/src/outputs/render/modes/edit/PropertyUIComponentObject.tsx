import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import PropertyUIComponentRemove from "@/outputs/render/modes/edit/PropertyUIComponentRemove.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { useCallback } from "react";

export default function PropertyUIComponentObject({
  propertyUIElement,
  object,
  index,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  index: number;
}) {
  const { Widget, iri } = useWidget(propertyUIElement) ?? {};
  const setTerm = useCallback(
    (newTerm: Term) => {
      propertyUIElement.replaceObject(object, newTerm);
    },
    [propertyUIElement, object, index],
  );

  return (
    <>
      {Widget && iri && <Widget shape={propertyUIElement} term={object} setTerm={setTerm} />}
      <PropertyUIComponentRemove propertyUIElement={propertyUIElement} object={object} />
    </>
  );
}
