import { RdfStore } from "rdf-stores";
import { Fragment } from "react";
import ChoiceElementComponent from "@/outputs/render/modes/view/ChoiceElementComponent.tsx";
// Group widget selection/rendering (getGroupWidget, PropertyGroup/CollapsiblePropertyGroup) has no
// edit-vs-view distinction of its own - the group widgets themselves pick edit's or view's own
// UIElementChildren for their children based on Environment.mode, so this one component is shared.
import GroupUIElementComponent from "@/outputs/render/modes/edit/GroupUIElementComponent.tsx";
// Same reasoning as GroupUIElementComponent above: which tab is active is a display choice with no
// edit-vs-view distinction, so this shared family/nav also lives under modes/edit/.
import TabbedPropertyGroupFamily from "@/outputs/render/modes/edit/TabbedPropertyGroupFamily.tsx";
import VerticalTabbedPropertyGroupFamily from "@/outputs/render/modes/edit/VerticalTabbedPropertyGroupFamily.tsx";
import PropertyUIElementComponent from "@/outputs/render/modes/view/PropertyUIComponent.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { termKey } from "@/helpers/termKey.ts";
import { hasViewableContent } from "@/structure/hasViewableContent.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { elementKey } from "@/structure/elementKey.ts";
import type { GroupUIElement } from "@/structure/GroupUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

const EMPTY_STORE = RdfStore.createDefault();

export default function UIElementChildren({
  elements: allElements,
}: {
  elements: (PropertyUIElement | ChoiceElement | GroupUIElement)[];
}) {
  const { languageMode } = useEnvironment();
  const { activeLanguage } = useContentLanguage();
  // A group whose properties would all render null (no values, or none in the active content
  // language) is dropped before it reaches its widget or a tab family - otherwise its heading, or
  // a vertical/horizontal tab with an empty panel, is left behind with nothing under it. Properties
  // and choices already render null on their own when empty, so only groups need filtering here.
  const firstElement = allElements[0];
  const elements = useReactiveRead(
    firstElement?.dataGraph ?? EMPTY_STORE,
    `${firstElement ? termKey(firstElement.focusNode) : ""}|${allElements.map(elementKey).join("|")}|${languageMode}|${activeLanguage}`,
    () =>
      allElements.filter(
        (element) =>
          element.kind !== "group" || hasViewableContent(element, activeLanguage, languageMode),
      ),
  );

  return (
    <TabbedPropertyGroupFamily elements={elements}>
      <VerticalTabbedPropertyGroupFamily elements={elements}>
        {elements.map((element) => (
          <Fragment key={elementKey(element)}>
            {element.kind === "property" ? (
              <PropertyUIElementComponent propertyUIElement={element} />
            ) : element.kind === "choice" ? (
              <ChoiceElementComponent choiceElement={element} />
            ) : (
              <GroupUIElementComponent group={element} />
            )}
          </Fragment>
        ))}
      </VerticalTabbedPropertyGroupFamily>
    </TabbedPropertyGroupFamily>
  );
}
