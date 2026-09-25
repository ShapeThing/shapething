import { useMemo } from "react";
import NodeUIElementChildren from "@/outputs/render/modes/view/NodeUIElementChildren.tsx";
import { valueNodeShapes } from "@/resolution/label.ts";
import { useNestedNode } from "@/outputs/render/hooks/useNestedNode.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function DetailsViewer({ shape, term }: WidgetProps) {
  // 10.2.2: the applicable shape may come from sh:node explicitly or be inferred via sh:class -
  // valueNodeShapes already unions both (see resolution/label.ts), same as valueNodeLabel's own
  // shui:LabelRole path resolution does for the property's value node.
  const nodeShapes = useMemo(() => valueNodeShapes(shape), [shape]);

  const nodeUiElement = useNestedNode(shape, term, { nodeShapes, nested: true })!;

  return (
    <div className="st-details-viewer">
      <div className="st-details-viewer__body">
        <NodeUIElementChildren nodeUiElement={nodeUiElement} />
      </div>
    </div>
  );
}
