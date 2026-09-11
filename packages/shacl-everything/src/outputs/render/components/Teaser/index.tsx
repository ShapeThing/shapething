import { useState } from "react";
import type { NamedNode, Term } from "@rdfjs/types";
import { stringToGradient } from "string-to-color-gradient";
import { highlightMatches } from "@/helpers/highlightMatches.tsx";
import { localName } from "@/helpers/localName.ts";
import ValueChip from "@/outputs/render/components/ValueChip/index.tsx";
import "./style.css";

type Props = {
  term: Term;
  label?: string;
  classification?: { term: Term; label: string };
  depiction?: NamedNode;
  // A longer, free-text summary (see resolution/label.ts's valueNodeDescription/st:DescriptionRole
  // - a ShapeThing-original property role, not part of the shui: spec) - shown as a clamped
  // snippet, not the full text, since this is a browsing card, not the value's own detail view.
  description?: string;
  highlight?: string;
};

/**
 * A reusable, read-only "teaser card" for a value: its DepictionRole image, LabelRole label,
 * ClassificationRole chip, and st:DescriptionRole description snippet - a richer, card-shaped
 * alternative to AutoCompleteOption's single-line dropdown row, for contexts that show several
 * candidates at once with room to browse rather than pick from a compact list (e.g.
 * FacetSearchModal's own results). Purely presentational: no edit-in-place/link-out affordances,
 * unlike AutoCompleteOption - callers that need the currently *selected* value's own actions
 * (editing/linking out) should keep using AutoCompleteOption, not this.
 */
export default function Teaser({
  term,
  label,
  classification,
  depiction,
  description,
  highlight,
}: Props) {
  const [hasError, setHasError] = useState<boolean | undefined>(undefined);
  const displayLabel = label ?? localName(term) ?? term.value;
  const isDirectRenderable =
    depiction?.value.includes(".svg") || depiction?.value.includes("data:");
  const classificationGradient = stringToGradient(classification?.label ?? "", {
    brightness: "light",
  });

  return (
    <span className="st-teaser">
      {depiction && !hasError ? (
        <img
          loading="lazy"
          onError={() => setHasError(true)}
          onLoad={() => setHasError(false)}
          className="st-teaser__depiction"
          src={
            isDirectRenderable
              ? depiction.value
              : `//wsrv.nl/?url=${encodeURIComponent(depiction.value)}&w=128&h=128&fit=cover`
          }
          alt=""
        />
      ) : (
        <span className="st-teaser__depiction-spacer" />
      )}
      <span className="st-teaser__body">
        <span className="st-teaser__title">
          {highlightMatches(displayLabel, highlight, "st-teaser__match")}
        </span>
        {classification && (
          <ValueChip
            colors={classificationGradient}
            label={classification.label}
            size="small"
            term={classification.term}
          />
        )}
        {description && <span className="st-teaser__description">{description}</span>}
      </span>
    </span>
  );
}
