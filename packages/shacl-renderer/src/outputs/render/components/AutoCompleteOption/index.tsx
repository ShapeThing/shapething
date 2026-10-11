import type { NamedNode, Term } from "@rdfjs/types";
import "./style.css";
import { useState } from "react";
import { Link } from "@/helpers/icons.tsx";
import { highlightMatches } from "@/helpers/highlightMatches.tsx";
import { localNameLabel } from "@/helpers/localNameLabel.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import {
  ClassificationChips,
  type Classification,
} from "@/outputs/render/components/ClassificationChip/index.tsx";
import ResourceEditButton, {
  type ResourceEditor,
} from "@/outputs/render/components/ResourceEditButton/index.tsx";

export type { ResourceEditor };

type Props = {
  term: Term;
  label?: string;
  classifications?: Classification[];
  depiction?: NamedNode;
  // A shui:IconRole icon - takes the image slot over `depiction` when both resolve, the same
  // precedence LabelViewer gives it, since this small next-to-the-label slot is what icons are for.
  icon?: NamedNode;
  highlight?: string;
  // Only passed for the currently selected value (never for a row in a dropdown list) - see
  // EnumSelectEditor. Offers a small "edit" affordance that opens `term` in a modal, rendered
  // through `nodeShapes`, when `term` both has a known shape and already exists in `dataGraph` -
  // see ResourceEditButton.
  resourceEditor?: ResourceEditor;
};

export default function AutoCompleteOption({
  term,
  label,
  classifications,
  depiction,
  icon,
  highlight,
  resourceEditor,
}: Props) {
  const [hasError, setHasError] = useState<boolean | undefined>(undefined);
  const { enableLinksToResources } = useEnvironment();
  const displayLabel = label ?? localNameLabel(term) ?? term.value;
  const image = icon ?? depiction;
  const isDirectRenderable = image?.value.includes(".svg") || image?.value.includes("data:");

  return (
    <span className="st-autocomplete-option">
      {image && !hasError ? (
        <img
          loading="lazy"
          onError={() => setHasError(true)}
          onLoad={() => setHasError(false)}
          className={
            icon
              ? "st-autocomplete-option__depiction st-autocomplete-option__icon"
              : "st-autocomplete-option__depiction"
          }
          src={
            isDirectRenderable
              ? image.value
              : `//wsrv.nl/?url=${encodeURIComponent(image.value)}&w=64&h=64&fit=cover&default=${encodeURIComponent(image.value)}`
          }
          alt=""
        />
      ) : (
        <span className="st-autocomplete-option__depiction-spacer"></span>
      )}
      <span className="st-autocomplete-option__label">
        <span className="st-autocomplete-option__label--inner">
          {highlightMatches(displayLabel, highlight, "st-autocomplete-option__match")}
          &nbsp;&nbsp;
        </span>
        <ClassificationChips classifications={classifications} />
      </span>
      <span className="st-autocomplete-option__content">
        {term.termType === "NamedNode" && (
          <span className="st-autocomplete-option__actions">
            <ResourceEditButton term={term} label={displayLabel} resourceEditor={resourceEditor} />
            {term.termType === "NamedNode" && enableLinksToResources && (
              <a
                className="st-autocomplete-option__iri"
                href={term.value}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Link />
              </a>
            )}
          </span>
        )}
      </span>
    </span>
  );
}
