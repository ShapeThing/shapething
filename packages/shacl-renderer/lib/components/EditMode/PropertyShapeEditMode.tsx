import type { DatasetCore, NamedNode, Quad_Object, Quad_Subject, Term } from '@rdfjs/types'
import { useCallback, useContext, useMemo, useRef } from 'react'
import { languageContext } from '../../core/language-context'
import { mainContext } from '../../core/main-context'
import { rdf, sh, stsr } from '../../core/namespaces'
import { validationContext } from '../../core/validation/validation-context'
import Grapoi from '../../Grapoi'
import { isOrderedList } from '../../helpers/isOrderedList'
import { useEmptyTerm } from '../../hooks/useEmptyTerm'
import { filterToCurrentItems, useLanguageFilteredItems } from '../../hooks/useLanguageFilteredItems'
import { useStable } from '../../hooks/useStable'
import { Path } from '../../Path'
import { ValidationResult } from '../../ValidationReport'
import PropertyElement from '../PropertyElement'
import SortableStore from '../SortableStore/SortableStore'
import { subjectContext } from '../SubjectContextProvider'
import { AddButtons } from './AddButtons'
import PropertyObjectEditMode from './PropertyObjectEditMode'
import { splitPointers } from './splitPointers'
import ListWithOrderPredicateStorageStrategy from './storage/listWithOrderPredicate'
import NormalStorageStrategy from './storage/normal'
import RdfListStorageStrategy from './storage/rdfList'

type PropertyShapeEditModeProps = {
  data: Grapoi
  facetSearchData: Grapoi
  path: Path
  validationResults?: ValidationResult[]
  notifyParent: () => void
  notifyCount: number
  property: Grapoi
  nodeDataPointer: Grapoi
  dataset: DatasetCore
  facetSearchDataPointer: Grapoi
}

const noop = () => {}
const noopFalse = () => false

export default function PropertyShapeEditMode(props: PropertyShapeEditModeProps) {
  const { nodeDataPointer, validationResults, path, property, notifyParent, notifyCount } = props

  const { rerenderer } = useContext(mainContext)
  const { validate } = useContext(validationContext)
  const { subject } = useContext(subjectContext)
  const createEmptyTerm = useEmptyTerm()
  const { activeContentLanguage } = useContext(languageContext)

  const isRdfList = isOrderedList(path)
  const nestedOrderPredicate = property.out(stsr('nestedOrder')).term as NamedNode
  const isListWithOrderPredicate = !!nestedOrderPredicate
  const isList = isRdfList || isListWithOrderPredicate

  const storage = useMemo(
    () =>
      isRdfList
        ? new RdfListStorageStrategy(nodeDataPointer, path)
        : isListWithOrderPredicate
          ? new ListWithOrderPredicateStorageStrategy(nodeDataPointer, path, nestedOrderPredicate, property)
          : new NormalStorageStrategy(nodeDataPointer, path),
    [
      isRdfList,
      isListWithOrderPredicate,
      nestedOrderPredicate,
      nodeDataPointer.values.join(','),
      JSON.stringify(path),
      property.values.join(',')
    ]
  )

  const isLanguageProperty = property && rdf('langString').equals(property.out(sh('datatype')).term)

  const [items, realSetItems] = useLanguageFilteredItems(() => {
    // Add an empty item if there is non in the current language
    if (filterToCurrentItems(storage.getItems().terms, activeContentLanguage, isLanguageProperty).length === 0) {
      storage.addTerm(createEmptyTerm(property) as Quad_Object | undefined)
    }

    return storage.getItems()
  })

  const setItems = useCallback(() => {
    // This has a relationship to the drawer group, which is not ideal.
    if (filterToCurrentItems(storage.getItems().terms, activeContentLanguage, isLanguageProperty).length === 0) {
      const possibleGroupNode = property.out(sh('group')).term
      const isDrawerGroup =
        possibleGroupNode && !!property.node(possibleGroupNode).hasOut(rdf('type'), stsr('DrawerPropertyGroup')).term
      if (!isDrawerGroup) {
        storage.addTerm(createEmptyTerm(property) as Quad_Object | undefined)
      }
    }

    realSetItems(storage.getItems())
  }, [activeContentLanguage, createEmptyTerm, property.values.join(','), realSetItems, storage])

  // Might be helpful to rerender certain subject - predicates.
  // We only set the first level, this should also work with alternative property paths sh:path.
  for (const predicate of path?.[0]?.predicates ?? []) rerenderer.register(subject, predicate, setItems)

  const getItemsForSortable = useCallback(
    (parent?: Quad_Subject | undefined): Grapoi[] => (parent ? [] : storage.getItems().map((i: Grapoi) => i)),
    [storage.getItems.toString()]
  )
  const setItemsForSortable = useCallback(
    (items: Grapoi[]) => {
      storage.setSortedItems(items)
      setItems()
      // notifyParent()
    },
    [setItems.toString(), storage.setSortedItems.toString()]
  )

  const stableItems = useStable(items)

  // Stable callback references
  const setItemsRef = useRef(setItems)
  const validateRef = useRef(validate)
  const notifyParentRef = useRef(notifyParent)

  setItemsRef.current = setItems
  validateRef.current = validate
  notifyParentRef.current = notifyParent

  // Memoize notifyParent callback to prevent recreating on every render
  const stableNotifyParent = useCallback(() => {
    setItemsRef.current()
    notifyParentRef.current()
  }, [])

  const ItemComponent = useCallback(
    ({ pointer, index }: { pointer: Grapoi; index: number }) => {
      const itemValidationResults =
        validationResults?.filter(validationResult => validationResult.value?.term.equals(pointer.term)) ?? []

      const splitProperty = splitPointers(property, pointer)

      const setTerm = (term: Term) => {
        if (pointer.term.equals(term)) return
        if (term) {
          storage.replaceTerm(pointer.term as Quad_Object, term as Quad_Object)
          storage.markParentTouched()
        } else {
          storage.deleteTerm(pointer.term as Quad_Object)
        }
        setItemsRef.current()
        validateRef.current()
        notifyParentRef.current()
      }

      const deleteTerm = (singleUnifiedWidget?: boolean) => {
        if (singleUnifiedWidget) {
          storage.deleteTerms()
        } else {
          storage.deleteTerm(pointer.term as Quad_Object)
        }
        setItemsRef.current()
        validateRef.current()
        notifyParentRef.current()
      }

      return (
        <PropertyObjectEditMode
          {...props}
          property={splitProperty}
          data={pointer}
          items={items}
          key={splitProperty.values.join(':') + ':' + index}
          index={index}
          notifyCount={notifyCount}
          notifyParent={stableNotifyParent}
          validationResults={itemValidationResults}
          setTerm={setTerm}
          deleteTerm={deleteTerm}
        />
      )
    },
    [
      validationResults?.map(validationResult => JSON.stringify(validationResult)).join(','),
      property.values.join(','),
      items.values.join(','),
      stableNotifyParent,
      storage
    ]
  )

  const groupTerm = property.out(sh('node')).out(sh('property')).out(sh('group')).distinct().term
  const showNestedHeader =
    groupTerm &&
    property.out(sh('node')).out(sh('property')).terms.length > 1 &&
    !!property.node(groupTerm).hasOut(rdf('type'), stsr('HorizontalPropertyGroup')).term

  const hasErrors = validationResults?.some(validationResult => validationResult.severity.equals(sh('Violation')))

  return (
    <PropertyElement
      cssClass={hasErrors ? 'has-error' : ''}
      property={property}
      suffix={
        <AddButtons
          property={property}
          items={items}
          addTerm={(emptyTerm: Term) => {
            storage.addTerm(emptyTerm as Quad_Object | undefined)
            storage.markParentTouched()
            setItems()
          }}
        />
      }
    >
      <div className={`editors ${showNestedHeader ? 'nested' : ''}`}>
        {showNestedHeader ? (
          <div className="nested-header">
            {property
              .out(sh('node'))
              .out(sh('property'))
              .map((nestedProperty: Grapoi) => (
                <PropertyElement key={nestedProperty.value} property={nestedProperty}>
                  <></>
                </PropertyElement>
              ))}
          </div>
        ) : null}
        {isList ? (
          <SortableStore
            getItems={getItemsForSortable}
            setItems={setItemsForSortable}
            setGroupOfItem={noop}
            itemIsGroup={noopFalse}
            ItemComponent={ItemComponent}
          />
        ) : (
          [...stableItems].map((pointer, index) => <ItemComponent pointer={pointer} key={index} index={index} />)
        )}
      </div>
    </PropertyElement>
  )
}
