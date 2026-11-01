/* eslint-disable @typescript-eslint/no-unused-vars */
import type { NamedNode } from '@rdfjs/types'
import type { Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  property: NamedNode
  type: NamedNode
  domain?: NamedNode
  range?: NamedNode
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
