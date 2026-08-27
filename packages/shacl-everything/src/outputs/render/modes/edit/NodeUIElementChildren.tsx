import type { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { groupChildren } from "@/structure/groupChildren.ts";
import UIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";

export default function NodeUIElementChildren({ nodeUiElement }: { nodeUiElement: NodeUIElement }) {
  const elements = groupChildren(
    nodeUiElement.children(),
    nodeUiElement.shapesGraph,
    nodeUiElement.dataGraph,
    nodeUiElement.focusNode,
    nodeUiElement.widgetRegistry,
  );
  return <UIElementChildren elements={elements} />;
}
