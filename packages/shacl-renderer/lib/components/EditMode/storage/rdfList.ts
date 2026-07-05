import type { Quad_Object } from '@rdfjs/types'
import Grapoi from '../../../Grapoi'
import { deleteDescendants } from '../../../helpers/deleteDescendants'
import { mergePointers } from '../../../helpers/mergePointers'
import { nonNullable } from '../../../helpers/nonNullable'
import { TouchableTerm } from '../../../helpers/touchableRdf'
import { StorageStrategy } from './normal'

export default class RdfListStorageStrategy extends StorageStrategy {
  addTerms(newTerms?: Quad_Object[]) {
    if (!newTerms) return

    const predicate = this.path[0].predicates[0]
    const previousTerms = [...this.pointer.executeAll(this.path)]
      .map((item: Grapoi) => item.term)
      .filter(nonNullable) as TouchableTerm[]
    if (
      previousTerms.some((term: TouchableTerm) =>
        newTerms.some(newTerm => term.equals(newTerm) || term.touched === false)
      )
    )
      return

    const listPointer = this.pointer.executeAll([this.path?.[0]])

    if (!listPointer.isList()) {
      this.pointer.addList(predicate, newTerms)
    } else {
      const terms = [...previousTerms, ...newTerms]
      this.pointer.deleteList(predicate)
      this.pointer.addList(predicate, terms)
    }
  }

  addTerm(term?: Quad_Object) {
    if (!term) return
    this.addTerms([term])
  }

  replaceTerm(oldTerm: Quad_Object, newTerm: Quad_Object): void {
    const terms = [...this.pointer.executeAll(this.path)].map(i => i.term).filter(nonNullable)
    const oldIndex = terms.findIndex(item => item?.equals(oldTerm))
    terms.splice(oldIndex, 1, newTerm)
    const predicate = this.path[0].predicates[0]

    deleteDescendants(this.pointer.node(oldTerm))

    this.pointer.deleteList(predicate)
    this.pointer.addList(predicate, terms)
  }

  deleteTerm(termToRemove: Quad_Object) {
    const terms = [...this.pointer.executeAll(this.path)]
      .map((item: Grapoi) => item.term)
      .filter(term => !term.equals(termToRemove)) as TouchableTerm[]
    const predicate = this.path[0].predicates[0]

    deleteDescendants(this.pointer.node(termToRemove))

    this.pointer.deleteList(predicate)
    this.pointer.addList(predicate, terms)
  }

  deleteTerms(): void {
    throw new Error('RdfListStorageStrategy does not support deleteTerms. Use deleteTerm instead.')
  }

  getItems(): Grapoi {
    const pointer = this.pointer.executeAll([this.path[0]])
    const list = pointer.isList() ? pointer.list() : []
    return mergePointers([...list], pointer)
  }

  setSortedItems(items: Grapoi[]): void {
    const predicate = this.path[0].predicates[0]

    this.pointer.deleteList(predicate)
    this.pointer.addList(
      predicate,
      items.map(item => item.term)
    )
  }
}
