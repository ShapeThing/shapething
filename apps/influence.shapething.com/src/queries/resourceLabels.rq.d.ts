/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithLanguage, Prettify, TypedQuery } from '@shapething/typed-sparql'

interface QueryResult {
  term: NamedNode
  name?: LiteralWithLanguage<'en'>
  mulName?: LiteralWithLanguage<'mul'>
  propertyType: NamedNode | BlankNode | Literal
}

declare const _default: TypedQuery<Prettify<QueryResult>>
export default _default
