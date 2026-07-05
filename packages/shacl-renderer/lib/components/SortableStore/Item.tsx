import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { JSX, memo, useMemo } from 'react'
import { handleIcon } from '../../helpers/icons'
import { MemoIcon } from '../various/Icon'
import { GrapoiWithIdAndDepth, ItemComponentProps } from './SortableStore'

type Props = {
  id: string
  group: boolean
  pointer: GrapoiWithIdAndDepth
  className?: string
  depth: number
  ItemComponent: ({ pointer, index }: ItemComponentProps) => JSX.Element
}

export default memo(
  function Item({ id, pointer, group, className, depth, ItemComponent }: Props) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
    const MemoizedItemComponent = useMemo(() => ItemComponent, [ItemComponent])

    const style = useMemo(
      () => ({
        transform: CSS.Transform.toString(transform),
        transition,
        '--depth': depth
      }),
      [transform, transition, depth]
    )

    return (
      <li className={`item sortable-store-item ${group ? 'grouped' : ''} ${className}`} ref={setNodeRef} style={style}>
        <div className="inner">
          <button className="drag-handle" {...listeners} {...attributes}>
            <MemoIcon icon={handleIcon} />
          </button>
          <MemoizedItemComponent pointer={pointer} index={pointer.index} key={pointer.index} />
        </div>
      </li>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.pointer.values.join(',') === nextProps.pointer.values.join(',') &&
      prevProps.depth === nextProps.depth &&
      prevProps.id === nextProps.id &&
      prevProps.group === nextProps.group &&
      prevProps.className === nextProps.className
    )
  }
)
