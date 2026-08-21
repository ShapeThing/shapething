import type { NamedNode, Term } from "@rdfjs/types";
import "./style.css";
import { Fragment, useState, type ReactNode } from "react";
import { Link } from "@/helpers/icons.tsx";

type Props = {
  term: Term;
  label?: string;
  subLabel?: string;
  depiction?: NamedNode;
  highlight?: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Splits `text` on every case-insensitive occurrence of `query` and wraps the matches in <mark>,
// so a search snippet like "amst" reads as highlighted inside a result label of "Amsterdam".
function highlightMatches(text: string, query: string | undefined): ReactNode {
  const trimmed = query?.trim();
  if (!trimmed) return text;

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, "gi"));
  if (parts.length === 1) return text;

  return parts.map((part, index) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark key={index} className="st-autocomplete-option__match">
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

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
        {highlightMatches(displayLabel, highlight)}
      </span>
      {subLabel && (
        <span className="st-autocomplete-option__sub-label">
          {highlightMatches(subLabel, highlight)}
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
