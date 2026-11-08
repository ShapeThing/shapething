/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithDatatype, Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  kind: Literal
  item: NamedNode
  name: NamedNode | BlankNode | Literal
  description: NamedNode | BlankNode | Literal
  image?: NamedNode
  inception?: Literal
  publicationDate?: Literal
  openLibraryId?: Literal
  musicBrainzId?: Literal
  isBook: LiteralWithDatatype<'xsd:boolean'>
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
