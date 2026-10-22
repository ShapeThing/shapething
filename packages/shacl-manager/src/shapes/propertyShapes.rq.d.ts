/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, Literal, NamedNode } from "@rdfjs/types";
import type { Prettify, TypedQuery } from "@shapething/typed-sparql";

interface QueryResult {
  owner: NamedNode | BlankNode;
  propertyShape: NamedNode | BlankNode;
  path?: NamedNode | BlankNode | Literal;
  minCount?: NamedNode | BlankNode | Literal;
  maxCount?: NamedNode | BlankNode | Literal;
  order?: NamedNode | BlankNode | Literal;
  datatype?: NamedNode;
  class?: NamedNode;
  nodeKind?: NamedNode;
}

declare const _default: TypedQuery<Prettify<QueryResult>>;
export default _default;
