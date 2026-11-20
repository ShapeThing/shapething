/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  shape: NamedNode | BlankNode
  shapeOrigin: Literal
  mechanism: Literal
  via: NamedNode
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
