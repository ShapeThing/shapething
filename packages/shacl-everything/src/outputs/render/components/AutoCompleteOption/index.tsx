import type { NamedNode, Term } from "@rdfjs/types";
import "./style.css";

type Props = { term: Term; label?: string; subLabel?: string; depiction?: NamedNode };

export default function AutoCompleteOption({ term, label, subLabel, depiction }: Props) {
  return (
    <>
      {depiction && (
        <img className="st-autocomplete-option__depiction" src={depiction.value} alt="" />
      )}
      {label ?? term.value.split(/\/|#/g).pop()}
      {subLabel && <span className="st-autocomplete-option__sub-label">{subLabel}</span>}
      {term.termType === "NamedNode" && (
        <>
          &nbsp;<em className="st-autocomplete-option__iri">{term.value}</em>
        </>
      )}
    </>
  );
}
