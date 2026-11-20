import type { NamedNode, Term } from "@rdfjs/types";
import { highlightMatches } from "@/helpers/highlightMatches.tsx";
import { localNameLabel } from "@/helpers/localNameLabel.ts";
import {
  ClassificationChips,
  type Classification,
} from "@/outputs/render/components/ClassificationChip/index.tsx";
import { useResizedImage } from "@/outputs/render/hooks/useResizedImage.ts";
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
  const depictionSource = useResizedImage(depiction?.value, {
    width: 128,
    height: 128,
    fit: "cover",
  });
  const iconSource = useResizedImage(icon?.value, { width: 48, height: 48, fit: "contain" });
  const displayLabel = label ?? localNameLabel(term) ?? term.value;

  return (
    <span className="st-teaser">
      {depictionSource ? (
        <img
          loading="lazy"
          src={depictionSource.src}
          onError={depictionSource.onError}
          className="st-teaser__depiction"
          alt=""
        />
      ) : (
        <span className="st-teaser__depiction-spacer" />
      )}
      <span className="st-teaser__body">
        <span className="st-teaser__heading">
          {iconSource && (
            <img
              loading="lazy"
              src={iconSource.src}
              onError={iconSource.onError}
              className="st-teaser__icon"
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
