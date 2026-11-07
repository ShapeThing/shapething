/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  kind: Literal
  item: NamedNode
  name: NamedNode | BlankNode | Literal
  inception?: Literal
  publicationDate?: Literal
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
