import type { BlankNode, NamedNode } from "@rdfjs/types";
import { use } from "react";
import { DataFactory } from "rdf-data-factory";
import type { RdfStore } from "rdf-stores";
import { useDataModel } from "../../data-model/dataModelContext.ts";
import { select } from "../../data-model/select.ts";
import type { Origin } from "../useShapeTree.ts";
import type { Subject } from "../useSubject.ts";
import relatedShapes from "./relatedShapes.rq";

// One related shape, once, however many reasons the query gives for it.
export type RelatedShape = { shape: NamedNode | BlankNode; origin: Origin };

const factory = new DataFactory();

// Kept per (store, origin, subject) for as long as the store lives, so use() gets the same promise
// on every render and the query runs only once.
const cache = new WeakMap<RdfStore, Map<string, Promise<RelatedShape[]>>>();

// Suspends until the shapes that apply to the subject's focus nodes through a target other than
// sh:targetClass are loaded, in query order.
export function useRelatedShapes(subject: Subject, origin: Origin): RelatedShape[] {
  const { store, dataModelIRI } = useDataModel();
  const byKey = cache.get(store) ?? new Map<string, Promise<RelatedShape[]>>();
  cache.set(store, byKey);
  const key = `${origin} ${subject.kind} ${subject.term.termType} ${subject.term.value}`;
  if (!byKey.has(key)) {
    const rows = select(relatedShapes, store, {
      subject: subject.term,
      kind: factory.literal(subject.kind),
      dataModel: dataModelIRI,
      origin: factory.literal(origin),
    });
    byKey.set(
      key,
      rows.then((rows) => {
        const byShape = new Map<string, RelatedShape>();
        for (const { shape, shapeOrigin } of rows) {
          const id = `${shape.termType} ${shape.value}`;
          if (!byShape.has(id)) byShape.set(id, { shape, origin: shapeOrigin.value as Origin });
        }
        return [...byShape.values()];
      }),
    );
  }
  return use(byKey.get(key)!);
}
