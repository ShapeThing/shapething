import { useMemo, useState } from "react";
import type { Quad_Subject } from "@rdfjs/types";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { useResolvedValueNode } from "@/outputs/render/hooks/useResolvedValueNode.tsx";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import NodeUIElementChildren from "@/outputs/render/modes/view/NodeUIElementChildren.tsx";
import { shapesTargetingNode } from "@/resolution/targets.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "@/outputs/render/components/ValueChip/style.css";
import "./style.css";

/**
 * A value node's resolved display label - shui:LabelRole/rdfs:label/local-name, same as every
 * other value-node label, PLUS a federated fallback for a value whose roles only exist on a
 * remote endpoint (e.g. a dbpedia country IRI from a federated sh:in) - see useResolvedValueNode.
 * Renders as a hyperlink when the value is an IRI, plain text otherwise. The label is content, not
 * chrome (it names the actual value being viewed, e.g. an Organization's own name), so it follows
 * content language rather than interface language.
 *
 * Also shows a shui:DepictionRole image next to the label when one resolves (e.g. a country's
 * flag) - the same depiction AutoCompleteOption already shows while editing this same value, so
 * view mode doesn't lose it. A broken/slow-to-load depiction just hides itself (onError) rather
 * than leaving a broken-image icon next to a label that's otherwise perfectly fine to show.
 *
 * A shui:ClassificationRole, when one resolves, renders as a chip alongside the main label - the
 * same secondary disambiguating text AutoCompleteOption/EnumSelectEditor already resolve for this
 * same value while editing (see useResolvedValueNode), so view mode doesn't lose it either. Reuses
 * ValueChip's own pill styling (not the component itself - there's nothing to remove here).
 *
 * When Environment.enableViewInPlace is on and the value both already exists in dataGraph and is
 * targeted by at least one shape in shapesGraph (resolution/targets.ts's shapesTargetingNode),
 * clicking the link opens that resource read-only in a Modal instead of navigating away - a plain
 * ctrl/cmd/middle click still follows the href as a normal external link. A value with no shape
 * targeting it (or not yet in dataGraph) has nothing to render inside a modal, so it keeps the
 * plain external-link behavior unconditionally.
 */
export default function LabelViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const { enableViewInPlace } = useEnvironment();
  const [hasImageError, setHasImageError] = useState(false);
  const [open, setOpen] = useState(false);
  const { label, classification, depiction } = useResolvedValueNode(shape, term, [activeLanguage]);
  // SVGs/data URIs render directly; anything else goes through wsrv.nl to resize a (typically
  // much larger) hotlinked source image down to icon size - same reasoning as AutoCompleteOption.
  const isDirectRenderable =
    depiction?.value.includes(".svg") || depiction?.value.includes("data:");

  const nodeShapes = useReactiveRead(
    shape.dataGraph,
    `label-viewer-view-in-place@${term.value}`,
    () => {
      if (!enableViewInPlace || term.termType !== "NamedNode") return [];
      const existsInDataGraph = shape.dataGraph.getQuads(term, null, null).length > 0;
      if (!existsInDataGraph) return [];
      return shapesTargetingNode(term, shape.shapesGraph, shape.dataGraph);
    },
  );
  const canViewInPlace = term.termType === "NamedNode" && nodeShapes.length > 0;

  const nodeUiElement = useMemo(() => {
    if (!open || !canViewInPlace || term.termType !== "NamedNode") return undefined;
    return new NodeUIElement({
      shapesGraph: shape.shapesGraph,
      dataGraph: shape.dataGraph,
      scoresGraph: shape.scoresGraph,
      widgetRegistry: shape.widgetRegistry,
      focusNode: term as Quad_Subject,
      nodeShapes,
    });
  }, [open, canViewInPlace, shape, term, nodeShapes]);

  const classificationChip = classification && (
    <span className="st-value-chip">
      <span className="st-value-chip__label">{classification.label}</span>
    </span>
  );

  const image = depiction && !hasImageError && (
    <img
      loading="lazy"
      onError={() => setHasImageError(true)}
      className="st-label-viewer__depiction"
      src={
        isDirectRenderable
          ? depiction.value
          : `//wsrv.nl/?url=${encodeURIComponent(depiction.value)}&w=48&h=48&fit=cover`
      }
      alt=""
    />
  );

  if (term.termType !== "NamedNode") {
    return (
      <span className="st-label-viewer">
        {image}
        {label}
        {classificationChip}
      </span>
    );
  }

  return (
    <>
      <a
        className="st-label-viewer"
        href={term.value}
        target={canViewInPlace ? undefined : "_blank"}
        rel="noopener noreferrer"
        aria-haspopup={canViewInPlace ? "dialog" : undefined}
        onClick={
          canViewInPlace
            ? (event) => {
                // A modifier click (open in new tab/window) or middle click still follows href as
                // a normal link - only a plain left click is intercepted to open the modal.
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                event.preventDefault();
                setOpen(true);
              }
            : undefined
        }
      >
        {image}
        {label}
      </a>
      {classificationChip}
      {canViewInPlace && (
        <Modal open={open} onClose={() => setOpen(false)} title={label}>
          {nodeUiElement && <NodeUIElementChildren nodeUiElement={nodeUiElement} />}
        </Modal>
      )}
    </>
  );
}
