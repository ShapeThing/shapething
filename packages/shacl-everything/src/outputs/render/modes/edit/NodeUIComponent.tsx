import type { Quad_Subject } from "@rdfjs/types";
import { useCssImports } from "@/outputs/render/hooks/useCssImports.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useTargetWhereFragments } from "@/outputs/render/hooks/useTargetWhereFragments.tsx";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { Fragment, useMemo } from "react";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";

export default function NodeUIComponent({ noWrapper }: { noWrapper?: boolean }) {
  const { focusNode, shapesGraph, dataGraph, scoresGraph, widgets, nodeShapes } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  // nodeShapes stays static for the Environment's lifetime (see EnvironmentContextProvider's own
  // doc comment) - a sh:targetWhere fragment (3.1.3.6) has no explicit link into it, so it's folded
  // in here instead, reactively, on every render where useTargetWhereFragments detects a change.
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
  const cssImports = useMemo(() => nodeUiElement.cssImports(), [nodeUiElement]);
  useCssImports(cssImports);

  const WrapperElement = noWrapper ? Fragment : "div";

  return (
    <WrapperElement className="st-node-ui-component">
      {description && <p className="st-node-ui-component__description">{description}</p>}
      <NodeUIElementChildren nodeUiElement={nodeUiElement} />
    </WrapperElement>
  );
}
