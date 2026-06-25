import { ReactNode, useContext } from 'react'
import { getProperties, useGroupHasContents } from '../../../components/groups/PropertyGroup'
import { languageContext } from '../../../core/language-context'
import { mainContext } from '../../../core/main-context'
import { rdfs, sh } from '../../../core/namespaces'
import { language } from '../../../helpers/language'
import { useGroupLabel } from '../../../hooks/useGroupLabel'
import { WidgetProps } from '../../widgets-context'

export default function PropertyGroup(props: WidgetProps & { cssClass?: string }) {
  const { property, cssClass, notifyCount, notifyParent } = props

  const { activeInterfaceLanguage } = useContext(languageContext)
  const localName = property.term.value.split(/\/|#/g).pop()
  const { data: dataset, mode, shapePointer, facetSearchDataPointer } = useContext(mainContext)
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
  const description = property.out([sh('description'), rdfs('comment')]).best(language([activeInterfaceLanguage])).value

  const shouldShow = useGroupHasContents(property, shapePointer, props.nodeDataPointer, mode === 'view')

  return shouldShow ? (
    <div className={`group ${localName} ${cssClass ?? ''}`} data-term={property.term.value}>
      {label ? <h3 className="title">{label}</h3> : null}
      {description ? <div className="group-description">{description}</div> : null}
      <div className="group-inner">{properties}</div>
    </div>
  ) : null
}
