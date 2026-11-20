import type { BlankNode, NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { blankNodeId, findBlankNode } from "./blankNodes.ts";
import { iriToSegment, segmentToIri } from "./prefixes.ts";

type Context = { store: RdfStore; prefixes: Record<string, string> };

// "_:" marks a blank node, as in Turtle; no prefix may be called "_", so it never reads as a
// prefixed name. What follows is the blank node's content id (see blankNodes.ts), not its label.
const BLANK = "_:";

// The URL segment for a node: an IRI as in prefixes.ts, a blank node as "_:" + its content id.
export function termToSegment(term: NamedNode | BlankNode, { store, prefixes }: Context): string {
  return term.termType === "BlankNode"
    ? `${BLANK}${blankNodeId(store, term)}`
    : iriToSegment(term.value, prefixes);
}

// Undefined for a blank node id nothing in the store has (anymore).
export function segmentToTerm(
  segment: string,
  { store, prefixes }: Context,
): NamedNode | BlankNode | undefined {
  return segment.startsWith(BLANK)
    ? findBlankNode(store, segment.slice(BLANK.length))
    : segmentToIri(segment, prefixes);
}
