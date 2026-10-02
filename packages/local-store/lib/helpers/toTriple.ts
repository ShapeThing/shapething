import factory from '@rdfjs/data-model'
import type { Quad } from '@rdfjs/types'
import { withValidLangString } from './langString.ts'

export const toTriple = (quad: Quad) => factory.quad(quad.subject, quad.predicate, withValidLangString(quad.object))
