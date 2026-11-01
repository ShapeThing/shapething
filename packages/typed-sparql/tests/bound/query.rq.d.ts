import type { Literal, NamedNode } from '@rdfjs/types'
import type { LiteralWithDatatype } from '@shapething/typed-sparql'

interface QueryResult {
  hasLabel: LiteralWithDatatype<'xsd:boolean'>
}
