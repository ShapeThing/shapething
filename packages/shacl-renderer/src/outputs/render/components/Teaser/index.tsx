import { useState } from "react";
import type { NamedNode, Term } from "@rdfjs/types";
import { highlightMatches } from "@/helpers/highlightMatches.tsx";
import { localNameLabel } from "@/helpers/localNameLabel.ts";
import {
  ClassificationChips,
  type Classification,
} from "@/outputs/render/components/ClassificationChip/index.tsx";
import "./style.css";

type Props = {
  term: Term;
  label?: string;
  classifications?: Classification[];
  depiction?: NamedNode;
  // A shui:IconRole icon, shown small in front of the title - unlike `depiction`, which is the
  // card's own (per-resource) picture.
  icon?: NamedNode;
  // A longer, free-text summary (see resolution/label.ts's valueNodeDescription/shui:DescriptionRole)
  // - shown as a clamped snippet, not the full text, since this is a browsing card, not the
  // value's own detail view.
  description?: string;
  highlight?: string;
};

/**
 * A reusable, read-only "teaser card" for a value: its DepictionRole image, LabelRole label,
 * ClassificationRole chip, and shui:DescriptionRole description snippet - a richer, card-shaped
 * alternative to AutoCompleteOption's single-line dropdown row, for contexts that show several
 * candidates at once with room to browse rather than pick from a compact list (e.g.
 * FacetSearchModal's own results). Purely presentational: no edit-in-place/link-out affordances,
 * unlike AutoCompleteOption - callers that need the currently *selected* value's own actions
 * (editing/linking out) should keep using AutoCompleteOption, not this.
 */
export default function Teaser({
  term,
  label,
  classifications,
  depiction,
  icon,
  description,
  highlight,
}: Props) {
  const [hasError, setHasError] = useState<boolean | undefined>(undefined);
  const [hasIconError, setHasIconError] = useState(false);
  const displayLabel = label ?? localNameLabel(term) ?? term.value;
  const isDirectRenderable =
    depiction?.value.includes(".svg") || depiction?.value.includes("data:");

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
        <span className="st-teaser__heading">
          {icon && !hasIconError && (
            <img
              loading="lazy"
              onError={() => setHasIconError(true)}
              className="st-teaser__icon"
              src={
                icon.value.includes(".svg") || icon.value.includes("data:")
                  ? icon.value
                  : `//wsrv.nl/?url=${encodeURIComponent(icon.value)}&w=48&h=48&fit=contain`
              }
              alt=""
            />
          )}
          <span className="st-teaser__title">
            {highlightMatches(displayLabel, highlight, "st-teaser__match")}
          </span>
          <ClassificationChips classifications={classifications} />
        </span>
        {description && <span className="st-teaser__description">{description}</span>}
      </span>
    </span>
  );
}
