import { Localized } from "@fluent/react";
import type { Term } from "@rdfjs/types";
import { Close, Link } from "@/helpers/icons.tsx";
import "./style.css";

type Props = {
  term: Term;
  label: string;
  onRemove: () => void;
};

// A compact, fixed-height stand-in for AutoCompleteOption where several values render side by
// side in one widget (see SubClassEditor's multi-value pills) - AutoCompleteOption's optional
// depiction/sub-label make its height vary per value, which looks inconsistent repeated inline;
// this instead always renders at the same height as every other widget's single-value row.
export default function ValueChip({ term, label, onRemove }: Props) {
  return (
    <span className="st-value-chip">
      <span className="st-value-chip__label">{label}</span>
      {term.termType === "NamedNode" && (
        <a
          className="st-value-chip__iri"
          href={term.value}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Link />
        </a>
      )}
      <Localized id="property-remove-value" attrs={{ "aria-label": true }}>
        <button
          type="button"
          className="st-value-chip__remove"
          aria-label="Remove value"
          onClick={onRemove}
        >
          <Close />
        </button>
      </Localized>
    </span>
  );
}
