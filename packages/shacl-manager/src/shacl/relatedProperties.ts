import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import {
  groupShapesByPath,
  owl,
  rdf,
  rdfs,
  sh,
  walkShapeComposition,
} from "@shapething/shacl-renderer";
import type { RdfStore } from "rdf-stores";
import { termKey, type Resource } from "../data-model/rdf.ts";
import { classShapes } from "../owl/classShapes.ts";

export type RelatedProperty = { property: NamedNode; shapes: Resource[] };

// The property shapes the renderer would combine with `property` into one property: those with
// the same path in any set of shapes that applies to a focus node together with a shape declaring
// `property`. Such a set is a declaring shape, the node shapes it is pulled into through sh:node
// or sh:and, and, for every class one of them targets, the shapes an instance of that class or of
// one of its subclasses gets.
export function relatedProperties(store: RdfStore, property: Term): RelatedProperty[] {
  const declaring = store.getQuads(null, sh("property"), property).map(({ subject }) => subject);
  const composed = closure(declaring, (shape) => composingShapes(store, shape));

  const applicable = new Map<string, Term>();
  const add = (shape: Term) => applicable.set(termKey(shape), shape);
  composed.forEach(add);
  for (const shape of composed) {
    for (const targetClass of targetClasses(store, shape)) {
      for (const instanceClass of closure([targetClass], (term) => subClasses(store, term))) {
        classShapes(store, instanceClass).forEach(add);
      }
    }
  }

  const { propertyShapes } = walkShapeComposition(store, [...applicable.values()]);
  const groups = groupShapesByPath(store, propertyShapes).values();
  const group = [...groups].find(({ shapes }) => shapes.some((shape) => shape.equals(property)));

  const seen = new Set<string>([termKey(property)]);
  return (group?.shapes ?? []).flatMap((related) => {
    if (seen.has(termKey(related))) return [];
    seen.add(termKey(related));
    const shapes = store
      .getQuads(null, sh("property"), related)
      .flatMap(({ subject }) =>
        subject.termType === "NamedNode" || subject.termType === "BlankNode" ? [subject] : [],
      );
    return [{ property: related, shapes }];
  });
}

// The node shapes that pull `shape` into their own composition, through sh:node or sh:and. A
// property shape's sh:node describes its values, another focus node, so it does not count.
function composingShapes(store: RdfStore, shape: Term): Term[] {
  const viaNode = store
    .getQuads(null, sh("node"), shape)
    .map(({ subject }) => subject)
    .filter((subject) => !store.getQuads(subject, sh("path"), null).length);
  const viaAnd = store
    .getQuads(null, rdf("first"), shape)
    .flatMap(({ subject }) => listHeads(store, subject))
    .flatMap((head) => store.getQuads(null, sh("and"), head).map(({ subject }) => subject));
  return [...viaNode, ...viaAnd];
}

// The first cell of every RDF list `cell` is part of.
function listHeads(store: RdfStore, cell: Term): Term[] {
  const heads: Term[] = [];
  closure([cell], (current) => {
    const previous = store.getQuads(null, rdf("rest"), current).map(({ subject }) => subject);
    if (!previous.length) heads.push(current);
    return previous;
  });
  return heads;
}

// The classes a shape targets, the shape itself when it is a class too (an implicit target).
function targetClasses(store: RdfStore, shape: Term): Term[] {
  const explicit = store.getQuads(shape as Quad_Subject, sh("targetClass"), null);
  const implicit =
    store.getQuads(shape as Quad_Subject, rdf("type"), rdfs("Class")).length ||
    store.getQuads(shape as Quad_Subject, rdf("type"), owl("Class")).length;
  return [...explicit.map(({ object }) => object), ...(implicit ? [shape] : [])];
}

const subClasses = (store: RdfStore, term: Term): Term[] =>
  store.getQuads(null, rdfs("subClassOf"), term).map(({ subject }) => subject);

// `start` and everything `next` reaches from it, each once.
function closure(start: Term[], next: (term: Term) => Term[]): Term[] {
  const seen = new Map<string, Term>();
  const queue = [...start];
  while (queue.length) {
    const term = queue.shift()!;
    if (seen.has(termKey(term))) continue;
    seen.set(termKey(term), term);
    queue.push(...next(term));
  }
  return [...seen.values()];
}
