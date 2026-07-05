import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  UniqueIdentifier,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import type { Quad_Subject } from '@rdfjs/types'
import { JSX, memo, ReactNode, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Grapoi from '../../Grapoi'
import Item from './Item'
import { wrapGetItems } from './helpers'

export type GrapoiWithIdAndDepth = Grapoi & { id: string; depth: number; index: number; label: string }

export type ItemComponentProps = {
  pointer: Grapoi
  index: number
}

export type SortableStoreProps = {
  getItems: (parent?: Quad_Subject) => Grapoi[]
  setItems: (items: Grapoi[]) => void
  itemIsGroup: (item: Grapoi) => boolean
  setGroupOfItem: (item: Grapoi, group: Grapoi | null) => void
  children?: ReactNode
  ItemComponent: ({ pointer, index }: ItemComponentProps) => JSX.Element
  footer?: ReactNode
}

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always
  }
}

export default memo(function SortableStore(props: SortableStoreProps) {
  'use no memo'
  const { itemIsGroup, getItems: givenGetItems, setItems: givenSetItems, setGroupOfItem, ItemComponent, footer } = props
  const mouseSensor = useSensor(MouseSensor)
  const touchSensor = useSensor(TouchSensor)
  const keyboardSensor = useSensor(KeyboardSensor)
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor)
  const [active, setActive] = useState<UniqueIdentifier>()

  const getItems = wrapGetItems(givenGetItems)
  const items = useMemo(() => getItems(), [getItems])

  const activePointer = items.find(item => item.term.value === active)
  const [proposedDepth, setProposedDepth] = useState(0)

  const onDragStart = (event: DragStartEvent) => {
    setActive(event.active.id)
    const activePointer = items.find(item => item.value === event.active.id)!
    setProposedDepth(activePointer.depth)
  }

  const onDragMove = (event: DragMoveEvent) => {
    const oldIndex = event.active?.data.current?.sortable.index
    const newIndex = event.over?.data.current?.sortable.index
    const activePointer = items.find(item => item.value === event.active.id)
    if (newIndex === undefined || oldIndex === undefined || !activePointer) return

    const newItems = arrayMove(items, oldIndex, newIndex)

    const aboveItem = newItems[newIndex - 1]
    const belowItem = newItems[newIndex + 1]

    const aboveItemDepth = aboveItem?.depth ?? 0
    const belowItemDepth = belowItem?.depth ?? 0

    // Above item does not need to be a group, it can be a sibling.
    if (aboveItemDepth < belowItemDepth) {
      setProposedDepth(belowItemDepth)
    } else if (aboveItemDepth === belowItemDepth) {
      if (event.delta.x < 0 || !itemIsGroup(aboveItem)) {
        setProposedDepth(aboveItemDepth)
      } else {
        setProposedDepth(aboveItemDepth + 1)
      }
    } else if (!aboveItem || itemIsGroup(aboveItem)) {
      if (event.delta.x < 0) {
        setProposedDepth(aboveItemDepth)
      } else {
        setProposedDepth(aboveItemDepth + 1)
      }
    } else if (aboveItemDepth > belowItemDepth) {
      if (event.delta.x >= 0 && aboveItem) {
        setProposedDepth(Math.max(aboveItemDepth, belowItemDepth))
      } else {
        setProposedDepth(Math.min(aboveItemDepth, belowItemDepth))
      }
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    const oldIndex = event.active?.data.current?.sortable.index
    const newIndex = event.over?.data.current?.sortable.index
    const activePointer = items.find(item => item.value === event.active.id)
    if (newIndex === undefined || oldIndex === undefined || !activePointer) return

    const newItems = arrayMove(items, oldIndex, newIndex)

    let group = undefined
    let pointerIndex = newIndex - 1
    let pointer: GrapoiWithIdAndDepth | undefined

    while (group === undefined) {
      pointer = items[pointerIndex]
      if (pointerIndex < 1) group = null
      pointerIndex--
      if (itemIsGroup(pointer) && pointer.depth === proposedDepth - 1) {
        group = pointer
      }
    }

    setGroupOfItem(activePointer, group)

    // The side effect, the parent is responsible to change the data.
    givenSetItems(newItems)
    setProposedDepth(0)
    setActive(undefined)
  }

  return (
    <DndContext
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      collisionDetection={closestCorners}
      id="list"
      sensors={sensors}
      measuring={measuring}
    >
      <SortableContext items={items} strategy={rectSortingStrategy}>
        <ul className="sortable-store">
          {items.map(item => {
            return (
              <Item
                group={itemIsGroup(item)}
                id={item.value}
                depth={item.value === active ? proposedDepth : item.depth}
                key={item.value}
                pointer={item}
                className={item.value === active ? 'active' : ''}
                ItemComponent={ItemComponent}
              />
            )
          })}
        </ul>

        {createPortal(
          <DragOverlay className="shape-editor">
            {activePointer ? (
              <Item
                id={activePointer.term.value}
                pointer={activePointer}
                key={activePointer.term.value}
                depth={activePointer.depth}
                group={itemIsGroup(activePointer)}
                ItemComponent={ItemComponent}
                className="ghost"
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}

        {footer}
      </SortableContext>
    </DndContext>
  )
})
