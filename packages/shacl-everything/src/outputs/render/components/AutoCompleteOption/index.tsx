import type { NamedNode, Term } from "@rdfjs/types";
import "./style.css";
import { useState } from "react";

type Props = { term: Term; label?: string; subLabel?: string; depiction?: NamedNode };

export default function AutoCompleteOption({ term, label, subLabel, depiction }: Props) {
  const [hasError, setHasError] = useState<boolean | undefined>(undefined);

  return (
    <span className="st-autocomplete-option">
      {depiction && !hasError ? (
        <img
          loading="lazy"
          onError={() => setHasError(true)}
          onLoad={() => setHasError(false)}
          className="st-autocomplete-option__depiction"
          src={`//wsrv.nl/?url=${encodeURIComponent(depiction.value)}&w=64&h=64&fit=cover`}
          alt=""
        />
      ) : (
        <span className="st-autocomplete-option__depiction-spacer"></span>
      )}
      {label ?? term.value.split(/\/|#/g).pop()}
      {subLabel && <span className="st-autocomplete-option__sub-label">{subLabel}</span>}
      {term.termType === "NamedNode" && (
        <em className="st-autocomplete-option__iri">{term.value}</em>
      )}
    </span>
  );
}
