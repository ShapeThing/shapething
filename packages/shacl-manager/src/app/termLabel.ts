import type { BlankNode, NamedNode } from "@rdfjs/types";
import { describeBlankNode } from "../data-model/blankNodes.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import { compactIri } from "../data-model/prefixes.ts";

// Until labels are queried, a node is shown by its prefixed name, else the last segment of its IRI.
const localName = (iri: string) => iri.split(/[#/]/).filter(Boolean).pop() ?? iri;

export function termLabel(term: NamedNode | BlankNode, { prefixes }: DataModel): string {
  return term.termType === "BlankNode"
    ? "(blank node)"
    : (compactIri(term.value, prefixes) ?? localName(term.value));
}

// The tooltip: the full IRI, or for a blank node its content, since there is no name to show yet.
export function termTitle(term: NamedNode | BlankNode, { store }: DataModel): string {
  return term.termType === "BlankNode" ? describeBlankNode(store, term) : term.value;
}
