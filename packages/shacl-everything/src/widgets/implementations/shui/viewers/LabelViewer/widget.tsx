import { useState } from "react";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useResolvedValueNode } from "@/outputs/render/hooks/useResolvedValueNode.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
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
 */
export default function LabelViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const [hasImageError, setHasImageError] = useState(false);
  const { label, depiction } = useResolvedValueNode(shape, term, [activeLanguage]);
  // SVGs/data URIs render directly; anything else goes through wsrv.nl to resize a (typically
  // much larger) hotlinked source image down to icon size - same reasoning as AutoCompleteOption.
  const isDirectRenderable = depiction?.value.includes(".svg") || depiction?.value.includes("data:");

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
      </span>
    );
  }

  return (
    <a className="st-label-viewer" href={term.value} target="_blank" rel="noopener noreferrer">
      {image}
      {label}
    </a>
  );
}
