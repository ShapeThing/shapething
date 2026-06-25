import type { Term } from '@rdfjs/types'
import { NamedNode } from 'n3'
import { memo, Suspense, useContext, useEffect, useState } from 'react'
import { getFocusNodes } from '../../core/getFocusNodes'
import { mainContext } from '../../core/main-context'
import { dash, sh } from '../../core/namespaces'
import Grapoi from '../../Grapoi'
import { addIcon, editDocumentIcon, trashIcon } from '../../helpers/icons'
import { nonNullable } from '../../helpers/nonNullable'
import { TouchableTerm } from '../../helpers/touchableRdf'
import { Path } from '../../Path'
import { ValidationResult } from '../../ValidationReport'
import { AdditionalWidgetConfiguration, useWidget } from '../../widgets/widgets-context'
import ValidationResults from '../ValidationResults'
import { MemoIcon } from '../various/Icon'
import AddNestedNodeButton from './AddNestedNodeButton'
import EditNestedNodeButton from './EditNestedNodeButton'

export type PropertyObjectEditModeProps = {
  property: Grapoi
  data: Grapoi
  path: Path
  facetSearchData: Grapoi
  items: Grapoi
  validationResults?: ValidationResult[]
  deleteTerm: (singleUnifiedWidget?: boolean) => void
  index: number
  setTerm: (term: Term) => void
  notifyCount: number
  notifyParent: () => void
}

function PropertyObjectEditMode(props: PropertyObjectEditModeProps) {
  const { data, items, validationResults, setTerm, deleteTerm, property, notifyCount, notifyParent } = props
  const { update, fallback } = useContext(mainContext)

  const widgetItem = useWidget()(property, data)

  const [widgetConfiguration, setWidgetConfiguration] = useState<AdditionalWidgetConfiguration>()
  const [isDeleting, setIsDeleting] = useState(false)

  const focusShapes = getFocusNodes(property.node(), data).flatMap(result => result.shapes)

  const propertyClass = property.out(sh('class')).term
  const shapeIriByClass = propertyClass && property.node().hasOut(sh('targetClass'), propertyClass).term

  const shapes = property.node(
    [shapeIriByClass, ...focusShapes.flatMap(focusShapes => focusShapes.terms)].filter(nonNullable)
  )

  const showNestedNodeEditButton =
    shapes.ptrs.length &&
    !widgetItem?.meta.iri.equals(dash('DetailsEditor')) &&
    props.data.term.value &&
    !widgetItem?.meta.hideEditButton

  const nestedShapeIri = property.out(sh('class')).term
    ? shapes.hasOut(sh('targetClass'), property.out(sh('class')).term).term
    : (shapes.distinct().terms[0] as NamedNode)

  const showNestedNodeCreateButton =
    !data.term.value &&
    shapes.ptrs.length &&
    !widgetItem?.meta.iri.equals(dash('DetailsEditor')) &&
    !!(property.out(sh('node')).term || shapeIriByClass)

  const minCount = property.out(sh('minCount')).value ? parseInt(property.out(sh('minCount')).value.toString()) : 0
  const itemIsRequired = items.ptrs.length <= minCount
  const hasErrors = validationResults?.some(validationResult => validationResult.severity.equals(sh('Violation')))

  const hasValidationResultTypes = new Set(
    validationResults?.map(validationResult =>
      validationResult.severity.value.split(/\/|#/g).pop()?.toLocaleLowerCase()
    )
  )

  const showRemove =
    (!itemIsRequired && items.ptrs.length > 0 && (data.term as TouchableTerm).touched !== false) || hasErrors

  const onAnimationEnd = isDeleting
    ? () => {
        deleteTerm(widgetItem?.meta.singleUnifiedWidget)
        setIsDeleting(false)
        update() // We need this here so that the drawer group is able to re-render and remove empty fields.
      }
    : undefined

  const cssType = widgetItem?.meta.iri.value.split(/#|\//g).pop()?.replace('Editor', '').toLocaleLowerCase()
  const configuration: AdditionalWidgetConfiguration = widgetConfiguration ?? {}
  let shouldRender = configuration.displayCriteria ? configuration.displayCriteria(data.term, props.index) : true

  if (widgetItem?.meta.singleUnifiedWidget && props.index > 0) {
    shouldRender = false
  }

  if (!widgetItem) return null

  return (
    <>
      {props.index === 0 && configuration.header ? (
        <div className={`editor-header ${cssType}`}>{configuration.header()}</div>
      ) : null}

      {shouldRender ? (
        <div
          onAnimationEnd={onAnimationEnd}
          className={`editor ${cssType} ${isDeleting ? 'delete-animation' : ''} ${Array.from(
            hasValidationResultTypes.values()
          )
            .map(i => `has-${i}`)
            .join(' ')}`.trim()}
        >
          {validationResults?.length && (data.term as TouchableTerm).touched !== false ? (
            <ValidationResults results={validationResults} />
          ) : null}

          {widgetItem ? (
            <Suspense fallback={widgetItem.meta.noLoadingSkeleton ? null : fallback}>
              {/* @ts-expect-error TODO the types do not match */}
              <widgetItem.Component
                {...props}
                key={widgetItem.meta.singleUnifiedWidget ? 'single' : data.term.value}
                term={data.term}
                notifyCount={notifyCount}
                notifyParent={notifyParent}
                setTerm={setTerm}
                useConfigureWidget={hook => {
                  useEffect(() => {
                    setWidgetConfiguration(() => hook)
                  }, [])
                }}
              />
            </Suspense>
          ) : null}

          {showNestedNodeEditButton ? (
            <>
              <EditNestedNodeButton {...props} shapeIri={nestedShapeIri as NamedNode}>
                {onClick => (
                  <button className="button icon" key={`edit-resource:${data.value}`} onClick={onClick}>
                    <MemoIcon icon={editDocumentIcon} />
                  </button>
                )}
              </EditNestedNodeButton>
            </>
          ) : null}

          {showNestedNodeCreateButton ? (
            <AddNestedNodeButton {...props} shapeIri={shapes.term as NamedNode}>
              {onClick => (
                <button className="button icon" key={`create-resource:${shapes.value}`} onClick={onClick}>
                  <MemoIcon icon={addIcon} />
                </button>
              )}
            </AddNestedNodeButton>
          ) : null}

          {showRemove ? (
            <button
              data-testid="remove-object"
              className="button icon remove-object"
              onClick={async () => {
                if (configuration.deletionCriteria) {
                  const shouldBeDeleted = await configuration.deletionCriteria(data.term)
                  if (shouldBeDeleted) setIsDeleting(true)
                } else {
                  setIsDeleting(true)
                }
              }}
            >
              <MemoIcon className="trash-icon" icon={trashIcon} />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

export default memo(PropertyObjectEditMode, (prevProps, nextProps) => {
  // Only re-render if relevant props actually changed
  return (
    (!prevProps.data.term || !nextProps.data.term || prevProps.data.term.equals(nextProps.data.term)) &&
    (!prevProps.property.term || !nextProps.property.term || prevProps.property.term.equals(nextProps.property.term)) &&
    prevProps.index === nextProps.index &&
    prevProps.notifyCount === nextProps.notifyCount &&
    prevProps.items.values.join(',') === nextProps.items.values.join(',') &&
    JSON.stringify(prevProps.validationResults) === JSON.stringify(nextProps.validationResults)
  )
})
