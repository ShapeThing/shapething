/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  property: NamedNode
  domain: NamedNode | BlankNode | Literal
  superProperty: NamedNode
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
