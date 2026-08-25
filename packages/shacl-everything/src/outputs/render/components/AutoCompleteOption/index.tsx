import type { NamedNode, Term } from "@rdfjs/types";
import "./style.css";
import { useState } from "react";
import { Link } from "@/helpers/icons.tsx";
import { highlightMatches } from "@/helpers/highlightMatches.tsx";

type Props = {
  term: Term;
  label?: string;
  subLabel?: string;
  depiction?: NamedNode;
  highlight?: string;
};

export default function AutoCompleteOption({ term, label, subLabel, depiction, highlight }: Props) {
  const [hasError, setHasError] = useState<boolean | undefined>(undefined);
  const displayLabel = label ?? term.value.split(/\/|#/g).pop() ?? "";
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
              : `//wsrv.nl/?url=${encodeURIComponent(depiction.value)}&w=64&h=64&fit=cover`
          }
          alt=""
        />
      ) : (
        <span className="st-autocomplete-option__depiction-spacer"></span>
      )}
      <span className="st-autocomplete-option__label">
        {highlightMatches(displayLabel, highlight, "st-autocomplete-option__match")}
      </span>
      {subLabel && (
        <span className="st-autocomplete-option__sub-label">
          {highlightMatches(subLabel, highlight, "st-autocomplete-option__match")}
        </span>
      )}
      {term.termType === "NamedNode" && (
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
  );
}
