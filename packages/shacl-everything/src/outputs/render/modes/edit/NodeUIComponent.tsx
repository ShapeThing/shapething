import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useMemo } from "react";
import { Localized } from "@fluent/react";

export default function NodeUIComponent() {
  const { focusNode, shapesGraph, dataGraph, nodeShapes } = useEnvironment();
  const nodeUiElement = useMemo(
    () =>
      new NodeUIElement({
        shapesGraph,
        dataGraph,
        focusNode,
        nodeShapes,
      }),
    [shapesGraph, dataGraph, focusNode, nodeShapes],
  );

  return (
    <div>
      {nodeUiElement.children().map((child, index) => (
        <div key={index}>
          {child instanceof PropertyUIElement ? (
            <Localized id="node-ui-property-element">
              <div>Property UI Element</div>
            </Localized>
          ) : (
            <Localized id="node-ui-choice-element">
              <div>Choice Element</div>
            </Localized>
          )}
        </div>
      ))}
    </div>
  );
}
