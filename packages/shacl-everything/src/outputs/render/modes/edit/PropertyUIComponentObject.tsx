import { useWidget } from "@/outputs/render/hooks/useWidget.tsx";
import PropertyUIComponentRemove from "@/outputs/render/modes/edit/PropertyUIComponentRemove.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Term } from "@rdfjs/types";
import { useCallback } from "react";
import style from "./style.module.css";
import { shui } from "@/helpers/namespaces.ts";

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

  return (
    <div className={style["property-ui-component-object"]}>
      {Widget && iri && <Widget shape={propertyUIElement} term={object} setTerm={setTerm} />}
      <PropertyUIComponentRemove
        onRemove={onTermSet}
        propertyUIElement={propertyUIElement}
        object={object}
      />
    </div>
  );
}
