import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { sh } from "@/helpers/namespaces.ts";

/** Whether `shape` is declared `sh:deactivated true` - a deactivated shape is never evaluated. */
export function isDeactivated(shape: Term, shapesGraph: RdfStore): boolean {
  return shapesGraph
    .getQuads(shape, sh("deactivated"), null)
    .some((quad) => quad.object.value === "true");
}
