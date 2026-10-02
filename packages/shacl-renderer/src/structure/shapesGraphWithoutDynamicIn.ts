import { RdfStore } from "rdf-stores";
import { sh } from "@/helpers/namespaces.ts";
import { findDynamicInSubjects } from "@/structure/dynamicIn.ts";

/**
 * A copy of `shapesGraph` with every dynamic `sh:in [ sh:select "..." ]` triple removed, so a
 * `ShaclEngine` built from the result never evaluates that sh:in as a live constraint -
 * shacl-engine's own generic sh:in evaluation pulls its *entire* baseline result set (e.g. every
 * dbo:Philosopher on DBpedia) just to check membership of one already-known value, on every
 * validation pass. ValidationContextProvider instead validates such a property's current value(s)
 * itself, via a VALUES-bound query scoped to just those values (see
 * validateDynamicInProperties.ts) - this function is what keeps shacl-engine from also (wastefully,
 * redundantly) running the unscoped version.
 *
 * "Dynamic sh:in" itself is defined by findDynamicInSubjects() (shared with selectQueryFor.ts and
 * analysis/patterns.ts) - a single sh:in value, a BlankNode, carrying its own sh:select literal.
 * Any other sh:in shape - a plain rdf:List, or an unusual multi-value mix - is left completely
 * untouched and still validated by shacl-engine exactly as before.
 */
export function shapesGraphWithoutDynamicIn(shapesGraph: RdfStore): RdfStore {
  const dynamicInSubjects = new Set(
    findDynamicInSubjects(shapesGraph).map((subject) => subject.value),
  );

  if (dynamicInSubjects.size === 0) return shapesGraph;

  const filtered = RdfStore.createDefault();
  for (const quad of shapesGraph.getQuads()) {
    if (quad.predicate.equals(sh("in")) && dynamicInSubjects.has(quad.subject.value)) continue;
    filtered.addQuad(quad);
  }
  return filtered;
}
