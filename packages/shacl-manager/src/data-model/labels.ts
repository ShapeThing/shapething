import type { Literal, Term } from "@rdfjs/types";
import type { TypedQuery } from "@shapething/typed-sparql";
import { compactIri, termKey } from "@/helpers/iri.ts";
import type labelsQuery from "./labels.rq";

type Row = typeof labelsQuery extends TypedQuery<infer T> ? T : never;

export type LabelIndex = Map<string, Literal[]>;

export function buildLabelIndex(rows: Row[]): LabelIndex {
  const index: LabelIndex = new Map();
  for (const row of rows) {
    if (row.label.termType !== "Literal") continue;
    const key = termKey(row.subject);
    const labels = index.get(key) ?? [];
    labels.push(row.label);
    index.set(key, labels);
  }
  return index;
}

// Exact language tag, then the same base language (en-GB matches @en), then untagged, then
// anything at all.
export function pickLiteral(literals: Literal[], language: string): Literal | undefined {
  const lang = language.toLowerCase();
  const base = lang.split("-")[0];
  return (
    literals.find((literal) => literal.language.toLowerCase() === lang) ??
    literals.find((literal) => literal.language.toLowerCase().split("-")[0] === base) ??
    literals.find((literal) => literal.language === "") ??
    literals[0]
  );
}

export function labelOf(index: LabelIndex, term: Term, language: string): string | undefined {
  const literals = index.get(termKey(term));
  return literals ? pickLiteral(literals, language)?.value : undefined;
}

/** A label to display, falling back to a compacted IRI (or the blank node id). */
export function displayLabel(index: LabelIndex, term: Term, language: string): string {
  return (
    labelOf(index, term, language) ??
    (term.termType === "NamedNode" ? compactIri(term.value) : `_:${term.value}`)
  );
}
