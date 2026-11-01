import type { BlankNode, Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithDatatype } from '@shapething/typed-sparql'

interface QueryResult {
  name: LiteralWithDatatype<'xsd:string'>
  age: LiteralWithDatatype<'xsd:integer'>
  url: NamedNode
  lower: Literal
  length: LiteralWithDatatype<'xsd:integer'>
  hasUrl: LiteralWithDatatype<'xsd:boolean'>
  label: NamedNode | BlankNode | Literal
}
