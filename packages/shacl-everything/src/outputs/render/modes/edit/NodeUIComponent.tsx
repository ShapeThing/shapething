import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useMemo } from "react";

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

  console.log(nodeUiElement.children());

  return (
    <div>
      <h1>Node UI Component</h1>
      {nodeUiElement.children().map((child, index) => (
        <div key={index}>
          {child instanceof PropertyUIElement ? (
            <div>Property UI Element</div>
          ) : (
            <div>Choice Element</div>
          )}
        </div>
      ))}
    </div>
  );
}
