import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithDatatype, LiteralWithLanguage, NumericLiteral } from '@shapething/typed-sparql'

interface QueryResult {
  recipe: NamedNode | BlankNode
  name: LiteralWithLanguage<'en'>
  chefName?: LiteralWithLanguage<'en'>
  servings?: NumericLiteral
  description?: Literal
  ingredients: LiteralWithDatatype<'xsd:integer'>
}
