import type { BlankNode, NamedNode, Quad_Object, Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";

/** `ex("Person")` → <http://example.org/Person>, for compact test fixtures. */
export const ex = (name: string): NamedNode => factory.namedNode(`http://example.org/${name}`);

export const blank = (id: string) => factory.blankNode(id);

export function storeOf(...triples: [Quad_Subject, NamedNode, Quad_Object][]): RdfStore {
  const store = RdfStore.createDefault();
  for (const [s, p, o] of triples) store.addQuad(factory.quad(s, p, o));
  return store;
}

/** An RDF list as triples, returning its head. */
export function list(
  items: Quad_Object[],
  prefix: string,
): { head: BlankNode; triples: [Quad_Subject, NamedNode, Quad_Object][] } {
  const rdf = (name: string) =>
    factory.namedNode(`http://www.w3.org/1999/02/22-rdf-syntax-ns#${name}`);
  const nodes = items.map((_, i) => blank(`${prefix}${i}`));
  const triples: [Quad_Subject, NamedNode, Quad_Object][] = items.flatMap((item, i) => [
    [nodes[i], rdf("first"), item],
    [nodes[i], rdf("rest"), nodes[i + 1] ?? rdf("nil")],
  ]);
  return { head: nodes[0], triples };
}
