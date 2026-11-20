import type { BlankNode, NamedNode, Term } from "@rdfjs/types";
import { use } from "react";
import { DataFactory } from "rdf-data-factory";
import type { RdfStore } from "rdf-stores";
import { useDataModel } from "../../../data-model/dataModelContext.ts";
import { select } from "../../../data-model/select.ts";
import type { Origin } from "../../useShapeTree.ts";
import type { Subject } from "../../useSubject.ts";
import shaclRules from "./shaclRules.rq";

// One SHACL rule, with its labels gathered from the query's one-row-per-label.
export type ShaclRule = {
  rule: NamedNode | BlankNode;
  shape: NamedNode | BlankNode;
  labels: Term[];
};

const factory = new DataFactory();

// Kept per (store, origin, subject) for as long as the store lives, so use() gets the same promise
// on every render and the query runs only once.
const cache = new WeakMap<RdfStore, Map<string, Promise<ShaclRule[]>>>();

// Suspends until the SHACL rules of the class or shape are loaded, in query order.
export function useShaclRules(subject: Subject, origin: Origin): ShaclRule[] {
  const { store, dataModelIRI } = useDataModel();
  const byKey = cache.get(store) ?? new Map<string, Promise<ShaclRule[]>>();
  cache.set(store, byKey);
  const key = `${origin} ${subject.kind} ${subject.term.termType} ${subject.term.value}`;
  if (!byKey.has(key)) {
    const rows = select(shaclRules, store, {
      subject: subject.term,
      kind: factory.literal(subject.kind),
      dataModel: dataModelIRI,
      origin: factory.literal(origin),
    });
    byKey.set(
      key,
      rows.then((rows) => {
        const byRule = new Map<string, ShaclRule>();
        for (const { rule, shape, label } of rows) {
          const id = `${rule.termType} ${rule.value}`;
          const entry = byRule.get(id) ?? { rule, shape, labels: [] };
          if (label && !entry.labels.some((known) => known.equals(label))) entry.labels.push(label);
          byRule.set(id, entry);
        }
        return [...byRule.values()];
      }),
    );
  }
  return use(byKey.get(key)!);
}
