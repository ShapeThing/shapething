import factory from '@rdfjs/data-model'
import type { NamedNode } from '@rdfjs/types'
import { sh, xsd } from '../../../core/namespaces'
import Grapoi from '../../../Grapoi'
import { mergePointers } from '../../../helpers/mergePointers'
import { Path } from '../../../Path'
import NormalStorageStrategy from './normal'

export default class ListWithOrderPredicateStorageStrategy extends NormalStorageStrategy {
  public nestedOrderPredicate: NamedNode
  public property: Grapoi

  constructor(pointer: Grapoi, path: Path, nestedOrderPredicate: NamedNode, property: Grapoi) {
    super(pointer, path)
    this.nestedOrderPredicate = nestedOrderPredicate
    this.property = property
  }

  getItems(): Grapoi {
    return mergePointers(
      this.pointer
        .executeAll(this.path)
        .map((i: Grapoi) => i)
        .sort((aPtr: Grapoi, bPtr: Grapoi) => {
          const a = this.pointer.node(aPtr.term)
          const b = this.pointer.node(bPtr.term)
          const aOrder = parseFloat(a.out(this.nestedOrderPredicate).value ?? '0')
          const bOrder = parseFloat(b.out(this.nestedOrderPredicate).value ?? '0')
          return aOrder - bOrder
        }),
      this.pointer.executeAll(this.path)
    )
  }

  setSortedItems(items: Grapoi[]): void {
    const datatype =
      (this.property.node().hasOut(sh('path'), this.nestedOrderPredicate).out(sh('datatype')).term as NamedNode) ??
      xsd('decimal')

    for (const [index, item] of items.entries()) {
      item.deleteOut(this.nestedOrderPredicate)
      item.addOut(this.nestedOrderPredicate, factory.literal((index + 1).toString(), datatype))
    }
  }
}
