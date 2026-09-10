import { Fragment } from "react";
import ChoiceElementComponent from "@/outputs/render/modes/view/ChoiceElementComponent.tsx";
// Group widget selection/rendering (getGroupWidget, PropertyGroup/CollapsiblePropertyGroup) has no
// edit-vs-view distinction of its own - the group widgets themselves pick edit's or view's own
// UIElementChildren for their children based on Environment.mode, so this one component is shared.
import GroupUIElementComponent from "@/outputs/render/modes/edit/GroupUIElementComponent.tsx";
// Same reasoning as GroupUIElementComponent above: which tab is active is a display choice with no
// edit-vs-view distinction, so this shared family/nav also lives under modes/edit/.
import TabbedPropertyGroupFamily from "@/outputs/render/modes/edit/TabbedPropertyGroupFamily.tsx";
import PropertyUIElementComponent from "@/outputs/render/modes/view/PropertyUIComponent.tsx";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

export default function UIElementChildren({
  elements,
}: {
  elements: (PropertyUIElement | ChoiceElement | GroupUIElement)[];
}) {
  return (
    <TabbedPropertyGroupFamily elements={elements}>
      {elements.map((element, index) => (
        <Fragment key={index}>
          {element.kind === "property" ? (
            <PropertyUIElementComponent propertyUIElement={element} />
          ) : element.kind === "choice" ? (
            <ChoiceElementComponent choiceElement={element} />
          ) : (
            <GroupUIElementComponent group={element} />
          )}
        </Fragment>
      ))}
    </TabbedPropertyGroupFamily>
  );
}
