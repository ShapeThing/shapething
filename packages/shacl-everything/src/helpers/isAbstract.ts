import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { dash } from "@/helpers/namespaces.ts";

/**
 * Whether `classOrShape` is declared `dash:abstract true` in any of `graphs` - DASH's marker for a
 * class that can't have direct instances, only instances of its (non-abstract) subclasses. It's a
 * class-level annotation, so it's typically found on an implicit class-shape (a node that is both
 * sh:NodeShape and rdfs:Class) in the shapes graph, but an ontology pulled into the data graph via
 * owl:imports can carry it too - hence more than one graph.
 *
 * Abstractness only ever restricts *creating* a direct instance (see useCreateInPlace,
 * SubClassEditor) and prefers a more specific shape over the abstract one during focus node/node
 * shape resolution - it never hides existing data.
 */
export function isAbstract(classOrShape: Term, graphs: RdfStore[]): boolean {
  if (classOrShape.termType !== "NamedNode" && classOrShape.termType !== "BlankNode") return false;
  return graphs.some((graph) =>
    graph
      .getQuads(classOrShape, dash("abstract"), null)
      .some((quad) => quad.object.value === "true"),
  );
}
