import { ReactNode, useContext } from 'react'
import { getProperties } from '../../../components/groups/PropertyGroup'
import { mainContext } from '../../../core/main-context'
import { tabbedPropertyGroupContext } from '../../../core/tabbedPropertyGroupContext'
import { useGroupLabel } from '../../../hooks/useGroupLabel'
import { WidgetProps } from '../../widgets-context'

export default function TabbedPropertyGroup(props: WidgetProps & { cssClass?: string }) {
  const { property, notifyCount, notifyParent } = props
  const localName = property.term.value.split(/\/|#/g).pop()
  const { data: dataset, shapePointer, facetSearchDataPointer } = useContext(mainContext)

  const { activeTabbedGroupIris } = useContext(tabbedPropertyGroupContext)

  const properties = getProperties({
    ...props,
    shapePointer,
    facetSearchDataPointer,
    group: property,
    dataset,
    notifyCount,
    notifyParent
  }) as ReactNode[]

  const label = useGroupLabel(property, props.nodeDataPointer)

  return activeTabbedGroupIris.some(activeTabbedGroupIri => activeTabbedGroupIri.equals(property.term)) ? (
    <div className={`tabbed-group ${localName}`} data-term={property.term.value}>
      <h1>{label}</h1>
      <div className="tabbed-group-contents">{properties}</div>
    </div>
  ) : null
}
