/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, NamedNode, Term } from "@rdfjs/types";
import type { Prettify, TypedQuery } from "@shapething/typed-sparql";

interface QueryResult {
  shape: NamedNode | BlankNode;
  targetKind: Term;
  target: NamedNode;
}

declare const _default: TypedQuery<Prettify<QueryResult>>;
export default _default;
