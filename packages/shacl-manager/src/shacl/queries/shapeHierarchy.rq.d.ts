/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithDatatype, Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  shape: NamedNode | BlankNode
  parent?: NamedNode | BlankNode
  propertyCount: LiteralWithDatatype<'xsd:integer'>
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
