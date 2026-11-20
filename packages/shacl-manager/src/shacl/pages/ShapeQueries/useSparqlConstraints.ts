import type { BlankNode, NamedNode, Term } from "@rdfjs/types";
import { use } from "react";
import { DataFactory } from "rdf-data-factory";
import type { RdfStore } from "rdf-stores";
import { useDataModel } from "../../../data-model/dataModelContext.ts";
import { select } from "../../../data-model/select.ts";
import type { Origin } from "../../useShapeTree.ts";
import type { Subject } from "../../useSubject.ts";
import sparqlConstraints from "./sparqlConstraints.rq";

// One SPARQL-based constraint, with its messages gathered from the query's one-row-per-message.
export type SparqlConstraint = {
  constraint: NamedNode | BlankNode;
  shape: NamedNode | BlankNode;
  path?: Term;
  messages: Term[];
};

const factory = new DataFactory();

// Kept per (store, origin, subject) for as long as the store lives, so use() gets the same promise
// on every render and the query runs only once.
const cache = new WeakMap<RdfStore, Map<string, Promise<SparqlConstraint[]>>>();

// Suspends until the SPARQL-based constraints of the class or shape are loaded, in query order.
export function useSparqlConstraints(subject: Subject, origin: Origin): SparqlConstraint[] {
  const { store, dataModelIRI } = useDataModel();
  const byKey = cache.get(store) ?? new Map<string, Promise<SparqlConstraint[]>>();
  cache.set(store, byKey);
  const key = `${origin} ${subject.kind} ${subject.term.termType} ${subject.term.value}`;
  if (!byKey.has(key)) {
    const rows = select(sparqlConstraints, store, {
      subject: subject.term,
      kind: factory.literal(subject.kind),
      dataModel: dataModelIRI,
      origin: factory.literal(origin),
    });
    byKey.set(
      key,
      rows.then((rows) => {
        const byConstraint = new Map<string, SparqlConstraint>();
        for (const { constraint, shape, path, message } of rows) {
          const id = `${constraint.termType} ${constraint.value}`;
          const entry = byConstraint.get(id) ?? { constraint, shape, path, messages: [] };
          if (message && !entry.messages.some((known) => known.equals(message)))
            entry.messages.push(message);
          byConstraint.set(id, entry);
        }
        return [...byConstraint.values()];
      }),
    );
  }
  return use(byKey.get(key)!);
}
