import { useDndMonitor, useDroppable } from '@dnd-kit/core'
import { Localized } from '@fluent/react'
import dataFactory from '@rdfjs/data-model'
import { NamedNode, Quad_Subject } from '@rdfjs/types'
import { CSSProperties, useContext, useMemo, useState } from 'react'
import AddNestedNodeButton from '../../../components/EditMode/AddNestedNodeButton'
import EditNestedNodeButton from '../../../components/EditMode/EditNestedNodeButton'
import SortableStore, { ItemComponentProps } from '../../../components/SortableStore/SortableStore'
import { MemoIcon } from '../../../components/various/Icon'
import { languageContext } from '../../../core/language-context'
import { mainContext } from '../../../core/main-context'
import { rdf, rdfs, schema, sh, xsd } from '../../../core/namespaces'
import Grapoi from '../../../Grapoi'
import { addIcon, editIcon } from '../../../helpers/icons'
import { language } from '../../../helpers/language'
import { toLocalName } from '../../../helpers/toLocalName'
import { useGroupLabel } from '../../../hooks/useGroupLabel'
import { WidgetProps } from '../../widgets-context'

const getItems = (dataPointer: Grapoi) => (parent?: Quad_Subject) => {
  // Useful sets
  const topLevelGroups = dataPointer
    .node()
    .hasOut(rdf('type'), sh('PropertyGroup'))
    .filter(group => !group.hasOut(sh('group')).term)
    .distinct()

  const usedGroups = dataPointer.out(sh('property')).out(sh('group')).distinct()
  const usedTopLevelGroups = usedGroups.filter(usedGroup =>
    topLevelGroups.terms.some(group => group.equals(usedGroup.term))
  )

  const selection = parent
    ? [dataPointer.node().hasOut(sh('group'), parent)]
    : [
        // Properties without groups.
        dataPointer
          .out(sh('property'))
          .filter(property => !property.hasOut(sh('group')).term)
          .distinct(),
        // Groups without groups.
        usedTopLevelGroups
      ]
  return selection
    .flatMap(pointer => pointer.map((innerPointer: Grapoi) => innerPointer))
    .sort((a: Grapoi, b: Grapoi) => {
      const aOrder = parseFloat(a.out(sh('order')).value ?? '0')
      const bOrder = parseFloat(b.out(sh('order')).value ?? '0')
      return aOrder - bOrder
    })
}

const setItems = () => (items: Grapoi[]) => {
  for (const [index, item] of items.entries()) {
    item.deleteOut(sh('order')).addOut(sh('order'), dataFactory.literal((index + 1).toString(), xsd('integer')))
  }
}

const itemIsGroup = () => (item: Grapoi) => {
  return item?.out(rdf('type')).terms.some(term => term.equals(sh('PropertyGroup')))
}

const setGroupOfItem = () => (item: Grapoi, group: Grapoi | null) => {
  item.deleteOut(sh('group'))
  if (group) {
    item.addOut(sh('group'), group.term)
  }
}

function ItemComponent({ pointer }: ItemComponentProps) {
  const { activeContentLanguage } = useContext(languageContext)
  const { shapePointer } = useContext(mainContext)
  const propertyShapeIri = shapePointer.node().hasOut(sh('path'), sh('path')).in().term
  const groupShapeIri = shapePointer.node().hasOut(sh('targetClass'), sh('PropertyGroup')).term

  const matches = pointer.out([sh('name'), sh('path'), rdfs('label'), schema('name')])
  const localName = toLocalName(matches.terms[0]) ?? toLocalName(pointer.term)
  const label = matches.best(language([activeContentLanguage, '', '*'])).value

  const isGroup = !!pointer.hasOut(rdf('type'), sh('PropertyGroup')).term
  const shape = isGroup ? groupShapeIri : propertyShapeIri

  return (
    <div className={`editor ${isGroup ? 'type-group' : 'type-property'}`}>
      {label ? <span className="label">{label}</span> : <span className="local-name">({localName})</span>}
      <span className="type chip" style={{ '--color': isGroup ? '#e0f7fa' : '#fff3e0' } as CSSProperties}>
        {isGroup ? <Localized id="group">Group</Localized> : <Localized id="property">Property</Localized>}
      </span>
      {shape ? (
        <div className="row-actions">
          <EditNestedNodeButton data={pointer} shapeIri={shape as NamedNode}>
            {onClick => (
              <button className="button icon" key={`edit-resource:${shape.value}`} onClick={onClick}>
                <MemoIcon icon={editIcon} />
              </button>
            )}
          </EditNestedNodeButton>
        </div>
      ) : null}
    </div>
  )
}

function UnusedGroup({ pointer, dataPointer, update }: { pointer: Grapoi; dataPointer: Grapoi; update: () => void }) {
  const label = useGroupLabel(pointer) ?? toLocalName(pointer.term) ?? pointer.term.value
  const { setNodeRef } = useDroppable({
    id: pointer.term.value
  })

  const [hasHoverOver, setHasHoverOver] = useState(false)

  useDndMonitor({
    onDragEnd(event) {
      if (event.over?.id === pointer.term.value) {
        const item = dataPointer.out(sh('property')).filter(property => property.term.value === event.active.id)
        item.deleteOut(sh('group')).addOut(sh('group'), pointer.term)
        update()
      }
    },
    onDragMove(event) {
      if (event.over?.id === pointer.term.value) {
        setHasHoverOver(true)
      } else if (hasHoverOver) {
        setHasHoverOver(false)
      }
    }
  })

  return (
    <div className={`editor unused-group type-group ${hasHoverOver ? 'has-hover-over' : ''}`} ref={setNodeRef}>
      <span className="label">{label}</span>
      <span className="type chip" style={{ '--color': '#e0f7fa' } as CSSProperties}>
        <Localized id="group">Group</Localized>
      </span>
    </div>
  )
}

function ShapeEditorInner() {
  const { dataPointer, shapePointer } = useContext(mainContext)

  const propertyShapeIri = shapePointer.node().hasOut(sh('path'), sh('path')).in().term
  const groupShapeIri = shapePointer.node().hasOut(sh('targetClass'), sh('PropertyGroup')).term

  if (!propertyShapeIri) throw new Error('Using the shape editor widget but could not find a property shape')
  if (!groupShapeIri) throw new Error('Using the shape editor widget but could not find a group shape')

  const [sortableKey, incrementSortableKey] = useState(0)

  const memoizedGetItems = useMemo(() => getItems(dataPointer), [dataPointer])
  const memoizedSetItems = useMemo(() => setItems(), [dataPointer])
  const memoizedSetGroupOfItem = useMemo(() => setGroupOfItem(), [dataPointer])
  const memoizedItemIsGroup = useMemo(() => itemIsGroup(), [dataPointer])

  const topLevelGroups = dataPointer
    .node()
    .hasOut(rdf('type'), sh('PropertyGroup'))
    .filter(group => !group.hasOut(sh('group')).term)
    .distinct()

  const usedGroups = dataPointer.out(sh('property')).out(sh('group')).distinct()
  const unusedGroups = topLevelGroups.filter(group => !usedGroups.terms.some(usedGroup => usedGroup.equals(group.term)))

  return (
    <div className="shape-editor">
      <div className="tree">
        <SortableStore
          key={sortableKey}
          getItems={memoizedGetItems}
          setItems={memoizedSetItems}
          setGroupOfItem={memoizedSetGroupOfItem}
          itemIsGroup={memoizedItemIsGroup}
          ItemComponent={ItemComponent}
          footer={
            <div className="unused-groups">
              <header className="unused-groups-header">
                <label className="label">
                  <Localized id="unused-groups">Unused Groups</Localized>
                </label>
                <span className="field-description">
                  <Localized id="unused-groups-description">
                    Groups that are not used in the current shape, drop a property or a group on one of the unused
                    groups to start using it.
                  </Localized>
                </span>
              </header>
              {unusedGroups.map((group: Grapoi) => (
                <UnusedGroup
                  update={() => incrementSortableKey(sum => sum + 1)}
                  key={group.term.value}
                  pointer={group}
                  dataPointer={dataPointer}
                />
              ))}
            </div>
          }
        />
      </div>

      <footer>
        <AddNestedNodeButton shapeIri={groupShapeIri as NamedNode}>
          {onClick => (
            <button onClick={onClick} className="button secondary outline icon">
              <MemoIcon icon={addIcon} />{' '}
              <span>
                <Localized id="add-a-group">Add a group</Localized>
              </span>
            </button>
          )}
        </AddNestedNodeButton>

        <AddNestedNodeButton
          shapeIri={propertyShapeIri as NamedNode}
          setTerm={newPropertySubject => {
            dataPointer.addOut(sh('property'), newPropertySubject)
            incrementSortableKey(key => key + 1)
          }}
        >
          {onClick => (
            <button onClick={onClick} className="button secondary outline icon">
              <MemoIcon icon={addIcon} />{' '}
              <span>
                <Localized id="add-a-property">Add a property</Localized>
              </span>
            </button>
          )}
        </AddNestedNodeButton>
      </footer>
    </div>
  )
}

export default function ShapeEditor({ useConfigureWidget }: WidgetProps) {
  useConfigureWidget({
    header: () => <ShapeEditorInner />,
    displayCriteria: () => false
  })
  return null
}
