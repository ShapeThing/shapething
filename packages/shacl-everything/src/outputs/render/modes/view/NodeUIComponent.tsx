import type { Quad_Subject } from "@rdfjs/types";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useTargetWhereFragments } from "@/outputs/render/hooks/useTargetWhereFragments.tsx";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { useMemo } from "react";
import NodeUIElementChildren from "@/outputs/render/modes/view/NodeUIElementChildren.tsx";

export default function NodeUIComponent() {
  const { focusNode, shapesGraph, dataGraph, scoresGraph, widgets, nodeShapes } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  // See modes/edit/NodeUIComponent.tsx's own comment on why this is folded in here rather than
  // into Environment.nodeShapes itself.
  const targetWhereFragments = useTargetWhereFragments(shapesGraph, dataGraph, focusNode);
  const effectiveNodeShapes = useMemo(
    () => dedupeTerms([...nodeShapes, ...targetWhereFragments]) as Quad_Subject[],
    [nodeShapes, targetWhereFragments],
  );
  const nodeUiElement = useMemo(
    () =>
      new NodeUIElement({
        shapesGraph,
        dataGraph,
        scoresGraph,
        widgetRegistry: widgets,
        focusNode,
        nodeShapes: effectiveNodeShapes,
      }),
    [shapesGraph, dataGraph, scoresGraph, widgets, focusNode, effectiveNodeShapes],
  );
  const description = nodeUiElement.description([activeInterfaceLanguage]);

  return (
    <div className="st-node-ui-component">
      {description && <p className="st-node-ui-component__description">{description}</p>}
      <NodeUIElementChildren nodeUiElement={nodeUiElement} />
    </div>
  );
}
