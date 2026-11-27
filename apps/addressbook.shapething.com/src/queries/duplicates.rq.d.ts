/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Literal, NamedNode } from '@rdfjs/types'
import type { Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  graph: NamedNode
  contact: NamedNode
  name?: Literal
  email?: Literal
  telephone?: Literal
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
