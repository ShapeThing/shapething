/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithDatatype, LiteralWithLanguage, Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  name?: LiteralWithLanguage<'en'>
  mulName?: LiteralWithLanguage<'mul'>
  fullName?: Literal
  description?: LiteralWithLanguage<'en'>
  image?: NamedNode
  banner?: NamedNode
  birthDate?: Literal
  deathDate?: Literal
  birthPlace?: NamedNode
  birthPlaceName?: LiteralWithLanguage<'en'>
  birthPlaceLocation?: Literal
  citizenship?: NamedNode
  citizenshipName?: LiteralWithLanguage<'en'>
  flag?: NamedNode
  demonym?: LiteralWithLanguage<'en'>
  demonymIsAdjective?: LiteralWithDatatype<'xsd:boolean'>
  publicationDate?: Literal
  article?: NamedNode
  isHuman: LiteralWithDatatype<'xsd:boolean'>
  hasAuthor: LiteralWithDatatype<'xsd:boolean'>
  influence: LiteralWithDatatype<'xsd:integer'>
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
