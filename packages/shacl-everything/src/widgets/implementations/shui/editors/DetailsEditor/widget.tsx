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

export default function DetailsEditor({ shape, term, flyOut }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const nodeShapes = useMemo(() => shape.get(sh("node")) as Quad_Subject[], [shape]);

  const nodeUiElement = useMemo(
    () =>
      new NodeUIElement({
        shapesGraph: shape.shapesGraph,
        dataGraph: shape.dataGraph,
        scoresGraph: shape.scoresGraph,
        focusNode: term as Quad_Subject,
        nodeShapes,
      }),
    [shape, term, nodeShapes],
  );

  // A fresh BlankNode has no data to derive a label from yet - valueNodeLabel() falls back to an
  // empty placeholder in that case, which is meaningless to show, so this widget prefers the outer
  // property's own name (e.g. "Address") until there's real data.
  const label = useReactiveRead(
    shape.dataGraph,
    `details-editor-label@${term.value}@${activeLanguage}@${activeInterfaceLanguage}`,
    () => {
      const rawLabel = valueNodeLabel({ term, propertyShape: shape, languages: [activeLanguage] });
      return term.termType === "BlankNode" && rawLabel.value === ""
        ? shape.label([activeInterfaceLanguage])
        : rawLabel.value;
    },
  );

  return (
    <div className="st-details-editor">
      <button type="button" className="st-details-editor__label">
        {label}
      </button>
      {flyOut}
      <div className="st-details-editor__body">
        <NodeUIElementChildren nodeUiElement={nodeUiElement} />
      </div>
    </div>
  );
}

// Placed between the label and the nested sub-form (see PropertyUIComponentObject) rather than
// trailing after the sub-form's own fields - every field in the sub-form is itself wrapped in its
// own ".st-property-object__widget" by PropertyUIComponentObject, so Tab from the label needs the
// fly-out to sit right there in the DOM to reach it at all, and to fall through into the sub-form's
// own first field afterwards, instead of exiting the whole widget the moment focus leaves the label.
DetailsEditor.placesOwnFlyOut = true;
