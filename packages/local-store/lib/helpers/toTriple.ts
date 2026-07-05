import factory from '@rdfjs/data-model'
import type { Quad } from '@rdfjs/types'

export const toTriple = (quad: Quad) => factory.quad(quad.subject, quad.predicate, quad.object)
