import { useMemo } from "react";
import type { Quad_Subject } from "@rdfjs/types";
import { sh } from "@/helpers/namespaces.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import NodeUIElementChildren from "@/outputs/render/modes/view/NodeUIElementChildren.tsx";
import { valueNodeLabel } from "@/resolution/label.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function DetailsViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const nodeShapes = useMemo(() => shape.get(sh("node")) as Quad_Subject[], [shape]);

  const nodeUiElement = useMemo(
    () =>
      new NodeUIElement({
        shapesGraph: shape.shapesGraph,
        dataGraph: shape.dataGraph,
        scoresGraph: shape.scoresGraph,
        widgetRegistry: shape.widgetRegistry,
        focusNode: term as Quad_Subject,
        nodeShapes,
      }),
    [shape, term, nodeShapes],
  );

  // A BlankNode with no label of its own falls back to the outer property's own name (e.g.
  // "Address"), same reasoning as DetailsEditor's identical fallback.
  const label = useReactiveRead(
    shape.dataGraph,
    `details-viewer-label@${term.value}@${activeLanguage}@${activeInterfaceLanguage}`,
    () => {
      const rawLabel = valueNodeLabel({ term, propertyShape: shape, languages: [activeLanguage] });
      return term.termType === "BlankNode" && rawLabel.value === ""
        ? shape.label([activeInterfaceLanguage])
        : rawLabel.value;
    },
  );

  return (
    <details className="st-details-viewer">
      <summary className="st-details-viewer__label">{label}</summary>
      <div className="st-details-viewer__body">
        <NodeUIElementChildren nodeUiElement={nodeUiElement} />
      </div>
    </details>
  );
}
