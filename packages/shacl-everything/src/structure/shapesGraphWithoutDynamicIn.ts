import { RdfStore } from "rdf-stores";
import { sh } from "@/helpers/namespaces.ts";

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
 * Mirrors selectQueryFor's own definition of "dynamic sh:in": a single sh:in value, a BlankNode,
 * carrying its own sh:select literal. Any other sh:in shape - a plain rdf:List, or an unusual
 * multi-value mix - is left completely untouched and still validated by shacl-engine exactly as
 * before; only the shapes selectQueryFor itself would recognize as dynamic are affected, so the
 * two stay in sync about which properties are "ours to check" versus "shacl-engine's to check".
 */
export function shapesGraphWithoutDynamicIn(shapesGraph: RdfStore): RdfStore {
  const inCountsBySubject = new Map<string, number>();
  for (const quad of shapesGraph.getQuads(null, sh("in"))) {
    inCountsBySubject.set(quad.subject.value, (inCountsBySubject.get(quad.subject.value) ?? 0) + 1);
  }

  const dynamicInSubjects = new Set<string>();
  for (const quad of shapesGraph.getQuads(null, sh("in"))) {
    if (inCountsBySubject.get(quad.subject.value) !== 1) continue;
    if (quad.object.termType !== "BlankNode") continue;

    const select = shapesGraph.getQuads(quad.object, sh("select"))[0]?.object;
    if (select?.termType === "Literal") dynamicInSubjects.add(quad.subject.value);
  }

  if (dynamicInSubjects.size === 0) return shapesGraph;

  const filtered = RdfStore.createDefault();
  for (const quad of shapesGraph.getQuads()) {
    if (quad.predicate.equals(sh("in")) && dynamicInSubjects.has(quad.subject.value)) continue;
    filtered.addQuad(quad);
  }
  return filtered;
}
