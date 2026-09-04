import { Fragment } from "react";
import ChoiceElementComponent from "@/outputs/render/modes/edit/ChoiceElementComponent.tsx";
import GroupUIElementComponent from "@/outputs/render/modes/edit/GroupUIElementComponent.tsx";
import PropertyUIElementComponent from "@/outputs/render/modes/edit/PropertyUIComponent.tsx";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

export default function UIElementChildren({
  elements,
  autoFocusFirst,
}: {
  elements: (PropertyUIElement | ChoiceElement | GroupUIElement)[];
  // See NodeUIElementChildren - only ever meant for elements[0], and only when it's a plain
  // property; a node whose first child is a choice/group is an accepted gap (see the plan), not
  // handled here.
  autoFocusFirst?: boolean;
}) {
  return (
    <>
      {elements.map((element, index) => (
        <Fragment key={index}>
          {element.kind === "property" ? (
            <PropertyUIElementComponent
              propertyUIElement={element}
              autoFocusFirst={index === 0 && autoFocusFirst}
            />
          ) : element.kind === "choice" ? (
            <ChoiceElementComponent choiceElement={element} />
          ) : (
            <GroupUIElementComponent group={element} />
          )}
        </Fragment>
      ))}
    </>
  );
}
