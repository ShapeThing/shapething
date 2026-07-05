import type { Quad, Term } from '@rdfjs/types'
import Grapoi from '../Grapoi'

export const deleteDescendants = (item: Grapoi) => {
  const dataset = item.ptrs[0].dataset

  if (!dataset) throw new Error('Cannot delete descendants of a pointer without dataset')

  const findDescendants = (subject: Term): Quad[] => {
    if (!['BlankNode', 'NamedNode'].includes(subject.termType)) return []
    const descendants = dataset.match(subject)
    return [...descendants, ...[...descendants].flatMap((quad: Quad) => findDescendants(quad.object))]
  }

  if (['BlankNode', 'NamedNode'].includes(item.term.termType)) {
    const allDescendants = findDescendants(item.term)
    for (const descendent of allDescendants) dataset.delete(descendent)
  }
}
