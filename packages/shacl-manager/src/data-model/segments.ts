import type { RdfStore } from "rdf-stores";
import { blankNodeId, findBlankNode } from "./blankNodes.ts";
import { iriToSegment, segmentToIri } from "./prefixes.ts";
import type { Resource } from "./rdf.ts";

type Context = { store: RdfStore; prefixes: Record<string, string> };

// "_:" marks a blank node, as in Turtle, followed by its content id rather than its label.
const BLANK = "_:";

export function termToSegment(term: Resource, { store, prefixes }: Context): string {
  return term.termType === "BlankNode"
    ? `${BLANK}${blankNodeId(store, term)}`
    : iriToSegment(term.value, prefixes);
}

// Undefined for a blank node id nothing in the store has (anymore).
export function segmentToTerm(segment: string, { store, prefixes }: Context): Resource | undefined {
  return segment.startsWith(BLANK)
    ? findBlankNode(store, segment.slice(BLANK.length))
    : segmentToIri(segment, prefixes);
}
