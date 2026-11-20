/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  shape: NamedNode | BlankNode
  propertyShape?: NamedNode | BlankNode
  path?: NamedNode | BlankNode | Literal
  constraint: NamedNode | BlankNode
  select?: NamedNode | BlankNode | Literal
  message?: NamedNode | BlankNode | Literal
  deactivated?: NamedNode | BlankNode | Literal
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
