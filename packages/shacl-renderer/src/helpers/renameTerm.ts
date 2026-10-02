import type { NamedNode, Quad, Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";

const swap = <T extends Term>(term: T, from: Term, to: NamedNode): T =>
  (term.equals(from) ? to : term) as T;

/**
 * `quads` with every occurrence of `from` - as a subject or an object, i.e. the resource itself
 * and every link pointing at it - replaced by `to`. Predicates and graphs are left alone: renaming
 * a resource never renames a property that happens to share its IRI.
 */
export function renameInQuads(quads: Quad[], from: Term, to: NamedNode): Quad[] {
  return quads.map((quad) =>
    quad.subject.equals(from) || quad.object.equals(from)
      ? factory.quad(
          swap(quad.subject, from, to) as Quad_Subject,
          quad.predicate,
          swap(quad.object, from, to) as Quad_Object,
          quad.graph,
        )
      : quad,
  );
}

/** renameInQuads applied to `store` in place - removing each affected quad, then adding its renamed copy. */
export function renameInStore(store: RdfStore, from: Term, to: NamedNode): void {
  const affected = [
    ...store.getQuads(from as Quad_Subject, null, null),
    ...store.getQuads(null, null, from as Quad_Object),
  ];
  for (const quad of affected) store.removeQuad(quad);
  for (const quad of renameInQuads(affected, from, to)) store.addQuad(quad);
}
