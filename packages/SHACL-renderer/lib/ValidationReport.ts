import type { DatasetCore, Term } from '@rdfjs/types'
import type { GraphPointer } from 'clownface'
import Grapoi from './Grapoi.js'
/**
 * Result of a SHACL validation.
 */
export type ValidationReport = {
  pointer: GraphPointer
  term: Term
  dataset: DatasetCore
  conforms: boolean
  results: ValidationResult[]
}
export type ValidationResult = {
  term: Term
  dataset: DatasetCore
  get message(): Term[]
  get path(): Term
  get focusNode(): Grapoi
  get severity(): Term
  get sourceConstraintComponent(): Term
  get sourceShape(): Term
  get value(): Grapoi
  get detail(): ValidationResult[]
  args: Record<string, unknown | Term>
}
