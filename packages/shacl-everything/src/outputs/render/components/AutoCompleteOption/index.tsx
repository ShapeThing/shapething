import type { NamedNode, Term } from "@rdfjs/types";
import "./style.css";
import { useState } from "react";
import { Link } from "@/helpers/icons.tsx";
import { highlightMatches } from "@/helpers/highlightMatches.tsx";
import { localNameLabel } from "@/helpers/localNameLabel.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import ClassificationChip, {
  type Classification,
} from "@/outputs/render/components/ClassificationChip/index.tsx";
import ResourceEditButton, {
  type ResourceEditor,
} from "@/outputs/render/components/ResourceEditButton/index.tsx";

export type { ResourceEditor };

type Props = {
  term: Term;
  label?: string;
  classification?: Classification;
  depiction?: NamedNode;
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
  classification,
  depiction,
  highlight,
  resourceEditor,
}: Props) {
  const [hasError, setHasError] = useState<boolean | undefined>(undefined);
  const { enableLinksToResources } = useEnvironment();
  const displayLabel = label ?? localNameLabel(term) ?? term.value;
  const isDirectRenderable =
    depiction?.value.includes(".svg") || depiction?.value.includes("data:");

  return (
    <span className="st-autocomplete-option">
      {depiction && !hasError ? (
        <img
          loading="lazy"
          onError={() => setHasError(true)}
          onLoad={() => setHasError(false)}
          className="st-autocomplete-option__depiction"
          src={
            isDirectRenderable
              ? depiction.value
              : `//wsrv.nl/?url=${encodeURIComponent(depiction.value)}&w=64&h=64&fit=cover&default=${encodeURIComponent(depiction.value)}`
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
        {classification && <ClassificationChip classification={classification} />}
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
