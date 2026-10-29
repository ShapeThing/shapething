/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  property: NamedNode | BlankNode
  type: NamedNode
  domain?: NamedNode | BlankNode | Literal
  range?: NamedNode | BlankNode | Literal
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
