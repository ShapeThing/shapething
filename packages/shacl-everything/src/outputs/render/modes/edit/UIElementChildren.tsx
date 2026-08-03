import { Fragment } from "react";
import ChoiceElementComponent from "@/outputs/render/modes/edit/ChoiceElementComponent.tsx";
import PropertyUIElementComponent from "@/outputs/render/modes/edit/PropertyUIComponent.tsx";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

export default function UIElementChildren({
  elements,
}: {
  elements: (PropertyUIElement | ChoiceElement)[];
}) {
  return (
    <>
      {elements.map((element, index) => (
        <Fragment key={index}>
          {element instanceof PropertyUIElement ? (
            <PropertyUIElementComponent propertyUIElement={element} />
          ) : (
            <ChoiceElementComponent choiceElement={element} />
          )}
        </Fragment>
      ))}
    </>
  );
}
