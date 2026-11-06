import type { NamedNode } from "@rdfjs/types";
import { wd } from "../rdf/namespaces.ts";

/** A Wikidata item identifier, such as Q859. */
export const isEntityId = (identifier: string): boolean => /^Q\d+$/.test(identifier);

export const entityIri = (id: string): NamedNode => {
  // Identifiers come from the URL and end up in queries, so only real item identifiers pass.
  if (!isEntityId(id)) throw new Error(`Not a Wikidata item identifier: ${id}`);
  return wd(id);
};

/** The identifier of a Wikidata item IRI, or undefined for any other IRI. */
export const entityId = (iri: NamedNode | string): string | undefined => {
  const value = typeof iri === "string" ? iri : iri.value;
  // Wikidata IRIs are http, but links to them are sometimes written as https.
  const match = /^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/.exec(value);
  return match?.[1];
};
