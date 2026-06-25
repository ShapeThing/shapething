import { DatasetCore } from '@rdfjs/types'
import { ReactNode, useContext, useMemo } from 'react'
import { rdf, sh } from '../../core/namespaces'
import Grapoi from '../../Grapoi'
import { nonNullable } from '../../helpers/nonNullable'
import parsePath from '../../helpers/parsePath'
import { widgetsContext } from '../../widgets/widgets-context'
import { filteredPropertiesFromShape, getElementHelpers } from '../NodeShape'

export type PropertyGroupProps = {
  group: Grapoi
  nodeDataPointer: Grapoi
  facetSearchDataPointer: Grapoi
  shapePointer: Grapoi
  className?: string
}

export const groupHasContents = (group: Grapoi, shapePointer: Grapoi, dataPointer: Grapoi, onlyWhenData: boolean) => {
  const groups = [...shapePointer.node().hasOut(rdf('type'), sh('PropertyGroup'))]
  const groupLevelGroups = groups.filter(innerGroup => innerGroup.out(sh('group')).term?.equals(group.term))
  const groupLevelProperties: Grapoi = shapePointer.out(sh('property')).hasOut(sh('group'), group.term)
  const someNestedGroupHasContents = groupLevelGroups.some(group =>
    groupHasContents(group, shapePointer, dataPointer, onlyWhenData)
  )

  const hasData = [...groupLevelProperties].some((property: Grapoi) => {
    const path = parsePath(property.out(sh('path')))
    const innerData = dataPointer.executeAll(path)
    return !!innerData.terms.length
  })

  return (onlyWhenData ? hasData : groupLevelProperties.ptrs.length) || someNestedGroupHasContents
}

export const useGroupHasContents = (
  group: Grapoi,
  shapePointer: Grapoi,
  dataPointer: Grapoi,
  onlyWhenData: boolean
) => {
  return useMemo(() => {
    return groupHasContents(group, shapePointer, dataPointer, onlyWhenData)
  }, [group, shapePointer, dataPointer, onlyWhenData])
}

export const getProperties = ({
  shapePointer,
  group,
  dataset,
  facetSearchDataPointer,
  nodeDataPointer,
  groupByUsage,
  notifyParent,
  notifyCount
}: {
  shapePointer: Grapoi
  group: Grapoi
  dataset: DatasetCore
  facetSearchDataPointer: Grapoi
  nodeDataPointer: Grapoi
  /**
   * This property exists for the Drawer group.
   */
  groupByUsage?: boolean
  notifyParent: () => void
  notifyCount: number
}) => {
  const groups = [...shapePointer.node().hasOut(rdf('type'), sh('PropertyGroup'))]
  const groupLevelGroups = groups.filter(innerGroup => innerGroup.out(sh('group')).term?.equals(group.term))
  const groupLevelProperties: Grapoi = filteredPropertiesFromShape(shapePointer).hasOut(sh('group'), group.term)
  const { groups: groupWidgets } = useContext(widgetsContext)

  const { mapGroup, mapProperty } = getElementHelpers({
    shapePointer,
    dataPointer: nodeDataPointer,
    facetSearchDataPointer,
    dataset,
    groups: groupWidgets,
    notifyParent,
    notifyCount
  })

  const formElements: [number, ReactNode, boolean, Grapoi][] = [
    ...[...groupLevelGroups.map(mapGroup), ...groupLevelProperties.map((property: Grapoi) => mapProperty(property))]
      .filter(nonNullable)
      .sort((a, b) => a[0] - b[0])
  ]

  if (groupByUsage) {
    return {
      used: formElements
        .filter(item => item[2] === true || parseInt(item[3].out(sh('minCount')).value ?? '0') > 0)
        .map(([, element]) => element),
      unused: formElements
        .filter(item => !item[2] && parseInt(item[3].out(sh('minCount')).value ?? '0') === 0)
        .map(([, , , property]) => property)
    }
  }

  return formElements.map(([, element]) => element)
}
