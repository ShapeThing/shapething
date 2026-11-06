/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithLanguage, Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  kind: Literal
  item: NamedNode
  name?: LiteralWithLanguage<'en'>
  mulName?: LiteralWithLanguage<'mul'>
  publicationDate?: Literal
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
