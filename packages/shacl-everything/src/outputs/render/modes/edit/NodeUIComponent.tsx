import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { useMemo } from "react";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";

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

  console.log(nodeUiElement);

  return (
    <div>
      <NodeUIElementChildren nodeUiElement={nodeUiElement} />
    </div>
  );
}
