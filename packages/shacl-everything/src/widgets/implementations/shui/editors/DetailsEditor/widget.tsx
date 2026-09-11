import { useMemo } from "react";
import type { Quad_Subject } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { sh } from "@/helpers/namespaces.ts";
import { Settings } from "@/helpers/icons.tsx";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";

export default function DetailsEditor({ shape, term, autoFocus }: WidgetProps) {
  const nodeShapes = useMemo(() => shape.get(sh("node")) as Quad_Subject[], [shape]);
  const { enableLogicalBranchSwitching, enableWidgetSwitching } = useEnvironment();

  const nodeUiElement = useMemo(
    () =>
      new NodeUIElement({
        shapesGraph: shape.shapesGraph,
        dataGraph: shape.dataGraph,
        scoresGraph: shape.scoresGraph,
        widgetRegistry: shape.widgetRegistry,
        focusNode: term as Quad_Subject,
        nodeShapes,
        ancestorPath: shape.nestedAncestorPath(),
      }),
    [shape, term, nodeShapes],
  );

  return (
    <div className="st-details-editor">
      {/* FormElement already renders this property's own sh:name above - no need to repeat a
          label here. This button stays purely as a focusable anchor that isn't inside a nested
          property's own .st-property-object__widget wrapper, so WidgetSlot's nearestFocused check
          can still find *this* widget's wrapper and keep the widget-switcher/branch-switcher
          fly-out reachable once the nested form below has its own focusable children. Placed
          before the nested body in DOM order (and visually restored to the trailing side via
          CSS `order`) so tabbing from it lands in the sub-form's own first field, rather than
          skipping past it straight to this property's own outer fly-out. */}
      {(enableLogicalBranchSwitching || enableWidgetSwitching) && (
        <Localized id="details-editor-options" attrs={{ "aria-label": true }}>
          <button
            type="button"
            className="st-icon-button st-details-editor__options"
            aria-label="Field options"
          >
            <Settings />
          </button>
        </Localized>
      )}
      <div className="st-details-editor__body">
        <NodeUIElementChildren nodeUiElement={nodeUiElement} autoFocusFirst={autoFocus} />
      </div>
    </div>
  );
}
