/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  class: NamedNode
  superClass?: NamedNode | BlankNode | Literal
  shape: NamedNode | BlankNode
  label?: NamedNode | BlankNode | Literal
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
