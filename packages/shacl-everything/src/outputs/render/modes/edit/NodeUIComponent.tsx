import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { useMemo } from "react";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";

export default function NodeUIComponent() {
  const { focusNode, shapesGraph, dataGraph, scoresGraph, widgets, nodeShapes } = useEnvironment();
  const nodeUiElement = useMemo(
    () =>
      new NodeUIElement({
        shapesGraph,
        dataGraph,
        scoresGraph,
        widgetRegistry: widgets,
        focusNode,
        nodeShapes,
      }),
    [shapesGraph, dataGraph, scoresGraph, widgets, focusNode, nodeShapes],
  );

  return (
    <div className="st-node-ui-component">
      <NodeUIElementChildren nodeUiElement={nodeUiElement} />
    </div>
  );
}
