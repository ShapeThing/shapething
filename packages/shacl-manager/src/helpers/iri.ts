import type { Term } from "@rdfjs/types";
import { prefixes } from "@/helpers/namespaces.ts";

// Longest namespace first, so e.g. dcterms: wins over a shorter namespace that is a prefix of it.
const sortedPrefixes = Object.entries(prefixes).sort(([, a], [, b]) => b.length - a.length);

/** The part after the last `#` or `/`, e.g. `prefLabel`; undefined when there is none. */
export function localName(iri: string): string | undefined {
  const match = /[^#/]+$/.exec(iri);
  return match?.[0];
}

/** `skos:prefLabel` for a known namespace, otherwise the IRI's local name. */
export function compactIri(iri: string): string {
  for (const [alias, namespace] of sortedPrefixes) {
    if (iri.startsWith(namespace) && iri.length > namespace.length) {
      return `${alias}:${iri.slice(namespace.length)}`;
    }
  }
  return localName(iri) ?? iri;
}

/** A string key that tells blank nodes and IRIs apart, for Maps and route params. */
export function termKey(term: Term): string {
  return term.termType === "BlankNode" ? `_:${term.value}` : term.value;
}
