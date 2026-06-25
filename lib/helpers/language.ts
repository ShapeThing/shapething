import factory from '@rdfjs/data-model'
import type { Dataset, NamedNode, Quad, Term } from '@rdfjs/types'
import { toLocalName } from './toLocalName'

/**
 * A @rdfjs/score function that returns a function to score terms based on their language.
 * It supports wildcard ('*'), empty string, and 'localName' as special cases.
 */
export function language(languages: (string | undefined)[]): ({
  dataset,
  graph,
  terms
}: {
  dataset: Dataset
  graph: NamedNode
  terms: Term[]
}) => {
  dataset: Dataset<Quad, Quad>
  graph: NamedNode<string>
  term: Term
  score: number
}[] {
  const scoreMap = new Map()
  let wildcardScore: number
  let stringScore: number
  let localNameScore: number

  for (const [index, language] of languages.entries()) {
    const score = 1 - index / languages.length

    if (language === '*') {
      wildcardScore = score
    } else if (language === '') {
      stringScore = score
    } else if (language === 'localName') {
      localNameScore = score
    } else {
      scoreMap.set(language, score)
    }
  }

  return ({ dataset, graph, terms = [] }: { dataset: Dataset; graph: NamedNode; terms: Term[] }) => {
    const results = []

    for (const term of terms) {
      let finalTerm = term
      let score = scoreMap.get('language' in term ? term.language : '')

      if (typeof score === 'undefined' && 'language' in term && term.language === '' && stringScore) {
        score = stringScore
      }

      if (typeof score === 'undefined' && !('language' in term) && stringScore && localNameScore) {
        score = localNameScore
        finalTerm = factory.literal(toLocalName(term) ?? '')
      }

      if (typeof score === 'undefined' && 'language' in term && typeof term.language === 'string' && wildcardScore) {
        score = wildcardScore
      }

      if (typeof score !== 'undefined') results.push({ dataset, graph, term: finalTerm, score })
    }

    return results
  }
}
