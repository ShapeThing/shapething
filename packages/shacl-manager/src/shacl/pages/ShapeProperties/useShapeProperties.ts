import type { BlankNode, NamedNode, Term } from "@rdfjs/types";
import { use } from "react";
import { DataFactory } from "rdf-data-factory";
import type { RdfStore } from "rdf-stores";
import { useDataModel } from "../../../data-model/dataModelContext.ts";
import { select } from "../../../data-model/select.ts";
import type { Origin } from "../../useShapeTree.ts";
import type { Subject } from "../../useSubject.ts";
import shapeProperties from "./shapeProperties.rq";

// One property shape, with its names gathered from the query's one-row-per-name.
export type ShapeProperty = {
  propertyShape: NamedNode | BlankNode;
  shape: NamedNode | BlankNode;
  path?: Term;
  names: Term[];
};

const factory = new DataFactory();

// Kept per (store, origin, subject) for as long as the store lives, so use() gets the same promise
// on every render and the query runs only once.
const cache = new WeakMap<RdfStore, Map<string, Promise<ShapeProperty[]>>>();

// Suspends until the property shapes of the class or shape are loaded, in query order.
export function useShapeProperties(subject: Subject, origin: Origin): ShapeProperty[] {
  const { store, dataModelIRI } = useDataModel();
  const byKey = cache.get(store) ?? new Map<string, Promise<ShapeProperty[]>>();
  cache.set(store, byKey);
  const key = `${origin} ${subject.kind} ${subject.term.termType} ${subject.term.value}`;
  if (!byKey.has(key)) {
    const rows = select(shapeProperties, store, {
      subject: subject.term,
      kind: factory.literal(subject.kind),
      dataModel: dataModelIRI,
      origin: factory.literal(origin),
    });
    byKey.set(
      key,
      rows.then((rows) => {
        const byPropertyShape = new Map<string, ShapeProperty>();
        for (const { propertyShape, shape, path, name } of rows) {
          const id = `${propertyShape.termType} ${propertyShape.value}`;
          const entry = byPropertyShape.get(id) ?? { propertyShape, shape, path, names: [] };
          if (name && !entry.names.some((known) => known.equals(name))) entry.names.push(name);
          byPropertyShape.set(id, entry);
        }
        return [...byPropertyShape.values()];
      }),
    );
  }
  return use(byKey.get(key)!);
}
