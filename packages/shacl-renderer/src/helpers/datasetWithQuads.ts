import type { DatasetCore, Quad, Term } from "@rdfjs/types";

function matchesTerm(pattern: Term | null | undefined, term: Term): boolean {
  return !pattern || pattern.equals(term);
}

/**
 * A read-only DatasetCore view of `base` plus `extra` - for validating a hypothetical triple (e.g.
 * a candidate value on a synthetic focus node) against a live dataGraph without copying it or
 * writing into it. match() returns another such view, so nested matches (as shacl-engine/grapoi
 * do when walking paths and lists) keep seeing `extra`. `extra` is assumed not to overlap `base`.
 */
export function datasetWithQuads(base: DatasetCore, extra: Quad[]): DatasetCore {
  return {
    get size() {
      return base.size + extra.length;
    },
    has: (quad) => base.has(quad) || extra.some((candidate) => candidate.equals(quad)),
    match: (subject, predicate, object, graph) =>
      datasetWithQuads(
        base.match(subject, predicate, object, graph),
        extra.filter(
          (quad) =>
            matchesTerm(subject, quad.subject) &&
            matchesTerm(predicate, quad.predicate) &&
            matchesTerm(object, quad.object) &&
            matchesTerm(graph, quad.graph),
        ),
      ),
    add: () => {
      throw new Error("datasetWithQuads() is read-only");
    },
    delete: () => {
      throw new Error("datasetWithQuads() is read-only");
    },
    *[Symbol.iterator]() {
      yield* base;
      yield* extra;
    },
  };
}
