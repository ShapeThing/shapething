import type { Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";

export type QuadDiff = { additions: Quad[]; deletions: Quad[] };

/**
 * The additions/deletions needed to turn `originalQuads` into `finalQuads` - a quad-for-quad diff
 * (a changed literal value shows up as one deletion + one addition, not an "update"), matching
 * what onSubmit already expects (see EditModeWrapper).
 */
export function diffQuads(originalQuads: Quad[], finalQuads: Quad[]): QuadDiff {
  const originalStore = RdfStore.createDefault();
  for (const quad of originalQuads) originalStore.addQuad(quad);

  const finalStore = RdfStore.createDefault();
  for (const quad of finalQuads) finalStore.addQuad(quad);

  const additions = finalQuads.filter(
    (quad) =>
      originalStore.getQuads(quad.subject, quad.predicate, quad.object, quad.graph).length === 0,
  );
  const deletions = originalQuads.filter(
    (quad) =>
      finalStore.getQuads(quad.subject, quad.predicate, quad.object, quad.graph).length === 0,
  );

  return { additions, deletions };
}
