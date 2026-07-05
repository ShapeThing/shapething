import type { NamedNode } from '@rdfjs/types'

export type Path = {
  quantifier: 'one' | 'oneOrMore' | 'zeroOrMore' | 'zeroOrOne'
  start: 'subject' | 'object'
  end: 'subject' | 'object'
  predicates: NamedNode[]
}[]
