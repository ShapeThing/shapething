import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { Fragment, useMemo } from "react";
import { Localized } from "@fluent/react";
import PropertyUIElementComponent from "@/outputs/render/modes/edit/PropertyUIComponent.tsx";

export default function NodeUIComponent() {
  const { focusNode, shapesGraph, dataGraph, scoresGraph, nodeShapes } = useEnvironment();
  const nodeUiElement = useMemo(
    () =>
      new NodeUIElement({
        shapesGraph,
        dataGraph,
        scoresGraph,
        focusNode,
        nodeShapes,
      }),
    [shapesGraph, dataGraph, scoresGraph, focusNode, nodeShapes],
  );

  return (
    <div>
      {nodeUiElement.children().map((child, index) => (
        <Fragment key={index}>
          {child instanceof PropertyUIElement ? (
            <PropertyUIElementComponent propertyUIElement={child} />
          ) : (
            <Localized id="node-ui-choice-element">
              <div>Choice Element</div>
            </Localized>
          )}
        </Fragment>
      ))}
    </div>
  );
}
