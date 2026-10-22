import type { NamedNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { compactIri } from "@/helpers/iri.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";

export type PathInfo = {
  /** A plain predicate path: the only kind that can line up 1:1 with an OWL property. */
  predicate?: NamedNode;
  /** Every predicate IRI that occurs anywhere in the path, in order of appearance. */
  iris: NamedNode[];
  /** SPARQL property path notation, e.g. `^skos:broader/skos:prefLabel`. */
  text: string;
};

const unary = [
  [sh("inversePath"), (inner: string) => `^${inner}`],
  [sh("zeroOrMorePath"), (inner: string) => `${inner}*`],
  [sh("oneOrMorePath"), (inner: string) => `${inner}+`],
  [sh("zeroOrOnePath"), (inner: string) => `${inner}?`],
] as const;

function listItems(head: Term, store: RdfStore): Term[] {
  const items: Term[] = [];
  const seen = new Set<string>();
  let current = head;
  while (!current.equals(rdf("nil")) && !seen.has(current.value)) {
    seen.add(current.value);
    const first = store.getQuads(current, rdf("first"))[0];
    if (!first) break;
    items.push(first.object);
    const rest = store.getQuads(current, rdf("rest"))[0];
    if (!rest) break;
    current = rest.object;
  }
  return items;
}

/** Reads a SHACL property path (SHACL 1.2 Core 2.3.1) into a summary. Never throws. */
export function describePath(store: RdfStore, path: Term): PathInfo {
  const iris: NamedNode[] = [];

  const walk = (node: Term, depth: number): string => {
    if (depth > 32) return "…";
    if (node.termType === "NamedNode") {
      if (!iris.some((iri) => iri.equals(node))) iris.push(node);
      return compactIri(node.value);
    }
    if (node.termType !== "BlankNode") return "?";

    const alternative = store.getQuads(node, sh("alternativePath"))[0];
    if (alternative) {
      const items = listItems(alternative.object, store).map((item) => walk(item, depth + 1));
      return `(${items.join("|")})`;
    }
    for (const [predicate, format] of unary) {
      const quad = store.getQuads(node, predicate)[0];
      if (quad) return format(wrap(quad.object, walk(quad.object, depth + 1)));
    }
    const items = listItems(node, store);
    if (items.length) return items.map((item) => walk(item, depth + 1)).join("/");
    return "?";
  };

  // A compound inner path needs brackets before a unary operator applies to it.
  const wrap = (node: Term, text: string) =>
    node.termType === "NamedNode" || text.startsWith("(") ? text : `(${text})`;

  const text = walk(path, 0);
  return { predicate: path.termType === "NamedNode" ? path : undefined, iris, text };
}
