import { NamedNode } from '@rdfjs/types'
import Grapoi from '../Grapoi'

export const byOrder = (predicates: NamedNode[]) => (pointer: Grapoi) => {
  const reversedPredicates = predicates.toReversed()
  const { dataset } = pointer
  const results = []

  for (const quad of pointer.quads()) {
    const predicate = reversedPredicates.find(p => p.equals(quad.predicate))
    if (predicate) {
      results.push({
        dataset,
        term: quad.object,
        predicate,
        score: reversedPredicates.findIndex(p => p.equals(predicate))
      })
    }
  }

  return results
}
