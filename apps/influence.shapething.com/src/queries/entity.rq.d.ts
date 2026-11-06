/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithDatatype, LiteralWithLanguage, Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  name?: LiteralWithLanguage<'en'>
  mulName?: LiteralWithLanguage<'mul'>
  description?: LiteralWithLanguage<'en'>
  image?: NamedNode
  birthDate?: Literal
  deathDate?: Literal
  publicationDate?: Literal
  article?: NamedNode
  isHuman: LiteralWithDatatype<'xsd:boolean'>
  hasAuthor: LiteralWithDatatype<'xsd:boolean'>
  influence: LiteralWithDatatype<'xsd:integer'>
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
