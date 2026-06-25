import type { Quad_Object } from '@rdfjs/types'
import Grapoi from '../../../Grapoi'
import { Path } from '../../../Path'
import { TouchableTerm } from '../../../helpers/touchableRdf'

export abstract class StorageStrategy {
  public pointer: Grapoi
  public path: Path

  constructor(pointer: Grapoi, path: Path) {
    this.pointer = pointer
    this.path = path
  }

  abstract addTerm(term?: Quad_Object): void
  abstract deleteTerm(term: Quad_Object): void
  abstract replaceTerm(oldTerm: Quad_Object, newTerm: Quad_Object): void
  abstract getItems(): Grapoi
  abstract deleteTerms(): void
  abstract setSortedItems(items: Grapoi[]): void

  markParentTouched() {
    if (!this.pointer.term) throw new Error('Pointer has no term, can not mark parent as touched.')
    ;(this.pointer.term! as TouchableTerm).touched = true
  }
}
/**
 * Supports forwards (normal) and reverse paths.
 */
export default class NormalStorageStrategy extends StorageStrategy {
  addTerm(term?: Quad_Object) {
    if (!term) return
    const isReverse = this.path.length === 1 && this.path[0].start === 'object'

    const predicate = this.path[0].predicates[0]
    if (isReverse) {
      this.pointer.addIn(predicate, term)
    } else {
      this.pointer.addOut(predicate, term)
    }
  }

  addTerms(terms: Quad_Object[] = []) {
    for (const term of terms) {
      this.addTerm(term)
    }
  }

  replaceTerm(oldTerm: Quad_Object, newTerm: Quad_Object): void {
    this.deleteTerm(oldTerm)
    this.addTerm(newTerm)
  }

  deleteTerm(term: Quad_Object) {
    const isReverse = this.path.length === 1 && this.path[0].start === 'object'
    const predicate = this.path[0].predicates[0]

    if (isReverse) {
      this.pointer.deleteIn(predicate, term)
    } else {
      this.pointer.deleteOut(predicate, term)
    }
  }

  deleteTerms(): void {
    const isReverse = this.path.length === 1 && this.path[0].start === 'object'
    const predicate = this.path[0].predicates[0]

    if (isReverse) {
      this.pointer.deleteIn(predicate)
    } else {
      this.pointer.deleteOut(predicate)
    }
  }

  getItems(): Grapoi {
    return this.pointer.executeAll(this.path)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setSortedItems(_items: Grapoi[]): void {
    throw new Error('The normal strategy can not be used to set sorted items.')
  }
}
