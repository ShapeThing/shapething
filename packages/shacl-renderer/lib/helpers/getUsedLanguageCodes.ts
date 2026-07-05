import type { Literal } from '@rdfjs/types'
import Grapoi from '../Grapoi'
import { sh } from '../core/namespaces'
import parsePath from './parsePath'

// Do not use the dataset as we might be displaying a sub set.
export const getUsedLanguageCodes = (shapePointer: Grapoi, dataPointer: Grapoi) => {
  const properties = shapePointer?.out(sh('property')) ?? []

  const quads = []
  for (const property of properties) {
    const pathTerm = property.out(sh('path'))
    if (!pathTerm) continue
    const path = parsePath(pathTerm)
    quads.push(...(dataPointer.executeAll(path)?.quads() ?? []))
    // TODO should we add support for nested nodes?
  }

  return [
    ...new Set(
      quads
        .filter(quad => quad.object.termType === 'Literal' && (quad.object as Literal).language)
        .map(quad => (quad.object as Literal).language)
    )
  ]
}
