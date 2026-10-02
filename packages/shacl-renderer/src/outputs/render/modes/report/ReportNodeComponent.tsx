import { Localized } from "@fluent/react";
import { useMemo } from "react";
import ResultMessages from "@/outputs/render/components/ValidationMessages/ResultMessages.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import NodeUIElementChildren from "@/outputs/render/modes/view/NodeUIElementChildren.tsx";
import { localNameLabel } from "@/helpers/localNameLabel.ts";
import { resolvedWidgets } from "@/preprocess/widgets.ts";
import { focusNodeLabel } from "@/resolution/label.ts";
import { shapesTargetingNode } from "@/resolution/targets.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import type { ReportFocusNode } from "@/validation/report.ts";

/**
 * One focus node of a validation report: its label as a heading, the results about the node as a
 * whole, then its affected properties - reportFocusNode.nodeShape lists exactly those (see
 * validation/report.ts), rendered by the view-mode tree with each result inline.
 */
export default function ReportNodeComponent({ reportFocusNode }: { reportFocusNode: ReportFocusNode }) {
  const { shapesGraph, dataGraph, scoresGraph, widgets, enableLinksToResources } = useEnvironment();
  const { activeLanguage } = useContentLanguage();
  const { focusNode, nodeShape, nodeResults } = reportFocusNode;

  const nodeUiElement = useMemo(
    () =>
      new NodeUIElement({
        shapesGraph,
        dataGraph,
        scoresGraph,
        widgetRegistry: resolvedWidgets(widgets),
        focusNode,
        nodeShapes: [nodeShape],
      }),
    [shapesGraph, dataGraph, scoresGraph, widgets, focusNode, nodeShape],
  );

  // The resource's own label (via its real shapes' shui:LabelRole, when they target it), else its
  // local name - a blank node has neither, and gets a generic heading.
  const label =
    focusNodeLabel({
      term: focusNode,
      nodeShapes: shapesTargetingNode(focusNode, shapesGraph, dataGraph),
      shapesGraph,
      dataGraph,
      languages: [activeLanguage],
    }) ?? (focusNode.termType === "NamedNode" ? (localNameLabel(focusNode) ?? focusNode.value) : undefined);

  const heading = label ? (
    focusNode.termType === "NamedNode" && enableLinksToResources ? (
      <a href={focusNode.value} title={focusNode.value} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    ) : (
      label
    )
  ) : (
    <Localized id="report-unnamed-resource">
      <span>Unnamed resource</span>
    </Localized>
  );

  return (
    <section className="st-report-mode__focus-node">
      <h3 className="st-report-mode__focus-node-label">{heading}</h3>
      <ResultMessages results={nodeResults} className="st-validation-messages--property" />
      <NodeUIElementChildren nodeUiElement={nodeUiElement} />
    </section>
  );
}
