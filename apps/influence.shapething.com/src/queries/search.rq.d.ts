/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithDatatype, LiteralWithLanguage, Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  item: NamedNode
  name?: LiteralWithLanguage<'en'>
  mulName?: LiteralWithLanguage<'mul'>
  description?: LiteralWithLanguage<'en'>
  image?: NamedNode
  birthDate?: Literal
  deathDate?: Literal
  inception?: Literal
  dissolved?: Literal
  influence: LiteralWithDatatype<'xsd:integer'>
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
