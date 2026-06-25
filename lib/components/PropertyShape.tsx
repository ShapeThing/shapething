import type { DatasetCore } from '@rdfjs/types'
import { isEqual } from 'lodash-es'
import { ReactComponentLike } from 'prop-types'
import { useContext, useEffect } from 'react'
import { Settings, mainContext } from '../core/main-context'
import { dash, sh, stf, stsr } from '../core/namespaces'
import { validationContext } from '../core/validation/validation-context'
import Grapoi from '../Grapoi'
import parsePath from '../helpers/parsePath'
import { TouchableTerm } from '../helpers/touchableRdf'
import { Path } from '../Path'
import PropertyShapeEditMode from './EditMode/PropertyShapeEditMode'
import PropertyShapeFacetMode from './FacetMode/PropertyShapeFacetMode'
import PropertyShapeViewMode from './ViewMode/PropertyShapeViewMode'

export type PropertyShapeProps = {
  property: Grapoi
  nodeDataPointer: Grapoi
  dataset: DatasetCore
  facetSearchDataPointer: Grapoi
  notifyCount: number
  notifyParent: () => void
}

export type PropertyShapeInnerProps = {
  nodeDataPointer: Grapoi
  property: Grapoi
  data: Grapoi
  path: Path
  facetSearchData: Grapoi
}

const modes: Record<Settings['mode'], ReactComponentLike> = {
  edit: PropertyShapeEditMode,
  view: PropertyShapeViewMode,
  facet: PropertyShapeFacetMode
}

const modePredicates = {
  edit: dash('editor'),
  view: dash('viewer'),
  facet: stf('facet')
}

export default function PropertyShape(props: PropertyShapeProps) {
  const { property } = props
  const { mode } = useContext(mainContext)

  const selectedWidgetIri = property.out(modePredicates[mode]).term

  const path = parsePath(property.out(sh('path')))
  const PropertyShapeInner = modes[mode]

  const { report } = useContext(validationContext)
  const validationResults =
    report?.results.filter(result => {
      const isMatch = isEqual(result.path, path) && props.nodeDataPointer.term.equals(result.focusNode.term)

      if (path?.length === 1 && path[0]?.predicates.length === 1) {
        const termsPointer = props.nodeDataPointer.out(path[0].predicates[0])
        const usableTerms = termsPointer.terms.filter(term => (term as TouchableTerm).touched !== false)
        if (!usableTerms.length) return false
      }

      return isMatch
    }) ?? []

  useEffect(() => {
    document.dispatchEvent(new CustomEvent('react.render'))
  })

  if (selectedWidgetIri?.equals(stsr('HideWidget'))) return null
  return PropertyShapeInner ? <PropertyShapeInner {...props} validationResults={validationResults} path={path} /> : null
}
