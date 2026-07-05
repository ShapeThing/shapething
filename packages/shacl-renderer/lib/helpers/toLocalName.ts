import type { Term } from '@rdfjs/types'

export const toLocalName = (term: Term) =>
  term ? (term.termType === 'NamedNode' ? term?.value?.split(/\/|#/g).pop() : term.value) : undefined
