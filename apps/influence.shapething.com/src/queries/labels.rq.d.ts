/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithLanguage, Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  entity?: NamedNode
  name?: LiteralWithLanguage<'en'>
  mulName?: LiteralWithLanguage<'mul'>
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
