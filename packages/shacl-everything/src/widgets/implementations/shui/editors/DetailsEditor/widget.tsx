import { useMemo } from "react";
import type { Quad_Subject } from "@rdfjs/types";
import { sh } from "@/helpers/namespaces.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function DetailsEditor({ shape, term }: WidgetProps) {
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

  // A fresh BlankNode has no data to derive a label from yet - valueNodeLabel() falls back to the
  // blank node's own (meaningless-to-show) identifier in that case, so this widget prefers the
  // outer property's own name (e.g. "Address") until there's real data. That fallback is detected
  // by rawLabel.value coming back identical to the blank node's own id, since no real label data
  // could coincidentally match the store's internal identifier.
  const label = useReactiveRead(
    shape.dataGraph,
    `details-editor-label@${term.value}@${activeLanguage}@${activeInterfaceLanguage}`,
    () => {
      const rawLabel = valueNodeLabel({ term, propertyShape: shape, languages: [activeLanguage] });
      return term.termType === "BlankNode" && rawLabel.value === term.value
        ? shape.label([activeInterfaceLanguage])
        : rawLabel.value;
    },
  );

  return (
    <div className="st-details-editor">
      <button type="button" className="st-details-editor__label">
        {label}
      </button>
      <div className="st-details-editor__body">
        <NodeUIElementChildren nodeUiElement={nodeUiElement} />
      </div>
    </div>
  );
}
