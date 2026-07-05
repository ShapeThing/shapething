import type { Quad_Subject, Term } from '@rdfjs/types'
import { rdfs, schema, sh } from '../../core/namespaces'
import Grapoi from '../../Grapoi'
import { language } from '../../helpers/language'
import { nonNullable } from '../../helpers/nonNullable'
import { GrapoiWithIdAndDepth } from './SortableStore'
const toLocalName = (term: Term) =>
  term ? (term.termType === 'NamedNode' ? term?.value?.split(/\/|#/g).pop() : term.value) : undefined

export const wrapGetItems = (getItemsGiven: (parent?: Quad_Subject) => Grapoi[]) => (parent?: Quad_Subject) => {
  let index = 0
  const wrapped = (parent: Quad_Subject | undefined, depth: number): GrapoiWithIdAndDepth[] =>
    getItemsGiven(parent)
      .flatMap((pointer: Grapoi) => {
        return pointer
          .map((innerPointer: GrapoiWithIdAndDepth) => {
            innerPointer.id = innerPointer.value
            innerPointer.depth = depth
            innerPointer.index = index++
            const matches = pointer.out([sh('name'), rdfs('label'), schema('name')])

            const label = matches.best(language(['en', '', '*'])).value
            innerPointer.label = label ?? toLocalName(innerPointer.term)

            return [innerPointer, ...wrapped(innerPointer.term as Quad_Subject, depth + 1)]
          })
          .flat()
      })
      .filter(nonNullable)

  return wrapped(parent, 0)
}
