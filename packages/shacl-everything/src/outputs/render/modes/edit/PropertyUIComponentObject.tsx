import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import PropertyUIComponentRemove from "@/outputs/render/modes/edit/PropertyUIComponentRemove.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { useCallback } from "react";
import "./style.css";
import { sh, shui } from "@/helpers/namespaces.ts";

export default function PropertyUIComponentObject({
  propertyUIElement,
  object,
  index,
  onTermSet,
}: {
  propertyUIElement: PropertyUIElement;
  object: Term;
  index: number;
  onTermSet: () => void;
}) {
  const { Widget, iri } = useWidget(shui("editor"), propertyUIElement, object) ?? {};
  const setTerm = useCallback(
    (newTerm: Term) => {
      propertyUIElement.replaceObject(object, newTerm);
      onTermSet?.();
    },
    [propertyUIElement, object, index, onTermSet],
  );
  const unit = propertyUIElement.getOne(sh("unit"))?.value;

  return (
    <div className="st-property-object">
      {Widget && iri && <Widget shape={propertyUIElement} term={object} setTerm={setTerm} />}
      {unit && <span className="st-property-object__unit">{unit}</span>}
      <PropertyUIComponentRemove
        onRemove={onTermSet}
        propertyUIElement={propertyUIElement}
        object={object}
      />
    </div>
  );
}
