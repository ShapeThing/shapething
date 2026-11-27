import type { Quad_Subject, Term } from "@rdfjs/types";
import { rdf, rdfs, sh } from "@shapething/shacl-renderer";
import type { RdfStore } from "rdf-stores";
import { termKey } from "../data-model/rdf.ts";

// The node shapes an instance of the class is validated against: the shapes targeting it or one
// of its superclasses through sh:targetClass, and the class itself when it is a node shape too
// (an implicit class target).
export function classShapes(store: RdfStore, classTerm: Term): Quad_Subject[] {
  const shapes = new Map<string, Quad_Subject>();
  const seen = new Set<string>();
  const queue = [classTerm];
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(termKey(current))) continue;
    seen.add(termKey(current));

    for (const { subject } of store.getQuads(null, sh("targetClass"), current)) {
      shapes.set(termKey(subject), subject);
    }
    if (
      current.termType !== "Literal" &&
      store.getQuads(current as Quad_Subject, rdf("type"), sh("NodeShape")).length
    ) {
      shapes.set(termKey(current), current as Quad_Subject);
    }
    for (const { object } of store.getQuads(current as Quad_Subject, rdfs("subClassOf"), null)) {
      if (object.termType === "NamedNode") queue.push(object);
    }
  }
  return [...shapes.values()];
}
