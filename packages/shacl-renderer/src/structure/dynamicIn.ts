import type { Quad, Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { sh } from "@/helpers/namespaces.ts";

/**
 * Every shape subject whose *only* sh:in triple points to a BlankNode carrying its own literal
 * sh:select - the "Dynamic SHACL" idiom for candidate values fetched live via SPARQL instead of an
 * author-supplied rdf:List enumeration (see EnumSelectEditor/AutoCompleteEditor's federated-search
 * stories). Shared by shapesGraphWithoutDynamicIn.ts (keeps shacl-engine from evaluating it),
 * selectQueryFor.ts (reads the query text back out) and analysis/patterns.ts (spec-usage
 * reporting), so all three stay in sync about what counts as "dynamic".
 */
export function findDynamicInSubjects(shapesGraph: RdfStore): Quad_Subject[] {
  const inQuadsBySubject = new Map<string, Quad[]>();
  for (const quad of shapesGraph.getQuads(null, sh("in"))) {
    const existing = inQuadsBySubject.get(quad.subject.value);
    if (existing) existing.push(quad);
    else inQuadsBySubject.set(quad.subject.value, [quad]);
  }

  const subjects: Quad_Subject[] = [];
  for (const quads of inQuadsBySubject.values()) {
    if (quads.length !== 1) continue;
    const [{ subject, object }] = quads;
    if (object.termType !== "BlankNode") continue;

    const select = shapesGraph.getQuads(object, sh("select"))[0]?.object;
    if (select?.termType === "Literal") subjects.push(subject);
  }
  return subjects;
}
