import type { NodeUIElement } from "@/structure/NodeUIElement.ts";
import UIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";

export default function NodeUIElementChildren({ nodeUiElement }: { nodeUiElement: NodeUIElement }) {
  return <UIElementChildren elements={nodeUiElement.children()} />;
}
