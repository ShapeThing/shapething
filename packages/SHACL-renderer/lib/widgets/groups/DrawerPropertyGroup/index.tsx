import { Localized } from '@fluent/react'
import { ReactNode, useContext, useState } from 'react'
import { getProperties, useGroupHasContents } from '../../../components/groups/PropertyGroup'
import PropertyElement from '../../../components/PropertyElement'
import { languageContext } from '../../../core/language-context'
import { mainContext } from '../../../core/main-context'
import { rdfs, sh } from '../../../core/namespaces'
import Grapoi from '../../../Grapoi'
import { language } from '../../../helpers/language'
import parsePath from '../../../helpers/parsePath'
import { useEmptyTerm } from '../../../hooks/useEmptyTerm'
import { useGroupLabel } from '../../../hooks/useGroupLabel'
import { WidgetProps } from '../../widgets-context'

export default function DrawerPropertyGroup(props: WidgetProps & { cssClass?: string }) {
  const { property, notifyCount, notifyParent } = props

  const { activeInterfaceLanguage } = useContext(languageContext)
  const [selectedPropertyIndex, setSelectedPropertyIndex] = useState<number | string>()
  const [selectedProperty, setSelectedProperty] = useState<Grapoi>()
  const localName = property.term.value.split(/\/|#/g).pop()
  const { data: dataset, update, mode, facetSearchDataPointer, shapePointer } = useContext(mainContext)
  const properties = getProperties({
    ...props,
    shapePointer,
    facetSearchDataPointer,
    group: property,
    dataset,
    groupByUsage: true,
    notifyCount,
    notifyParent
  }) as {
    used: ReactNode[]
    unused: Grapoi[]
  }

  const createEmptyTerm = useEmptyTerm()

  const label = useGroupLabel(property, props.nodeDataPointer)

  const description = property.out([sh('description'), rdfs('comment')]).best(language([activeInterfaceLanguage])).value

  const shouldShow = useGroupHasContents(property, shapePointer, props.nodeDataPointer, mode === 'view')

  return shouldShow ? (
    <div className={`group drawer ${localName} ${props.cssClass ?? ''}`} data-term={property.term.value}>
      {label ? <h3 className="title">{label}</h3> : null}
      {description ? <div className="group-description">{description}</div> : null}
      <div className="group-inner">
        {properties.used}
        {properties.unused.length ? (
          <PropertyElement
            cssClass={'drawer-add-property-wrapper'}
            required={true}
            label={<Localized id="add-a-property">Add a property</Localized>}
          >
            <div className="editors">
              <div className="editor drawer-add-property">
                <select
                  className="input"
                  value={selectedPropertyIndex}
                  onChange={event => {
                    const selectedProperty = properties.unused[parseInt(event.target.value)]
                    if (selectedProperty) {
                      setSelectedProperty(selectedProperty)
                      setSelectedPropertyIndex(parseInt(event.target.value))
                    }
                  }}
                >
                  <option value={''}>
                    <Localized id="pick-an-option">- Pick an option -</Localized>
                  </option>

                  {properties.unused.map((property, index) => {
                    const label =
                      property?.out([sh('name'), rdfs('label')]).best(language([activeInterfaceLanguage, '', '*']))
                        ?.value ?? property?.out(sh('path')).value?.split(/#|\//g).pop()

                    return (
                      <option key={property.values.join(',')} value={index}>
                        {label}
                      </option>
                    )
                  })}
                </select>

                <button
                  className="button primary outline"
                  onClick={() => {
                    setSelectedPropertyIndex('')
                    setSelectedProperty(undefined)

                    if (!selectedProperty) return
                    const path = parsePath(selectedProperty.out(sh('path')))
                    const itemPointer = props.nodeDataPointer.executeAll(path)
                    const emptyTerm = createEmptyTerm(selectedProperty, itemPointer)
                    const predicate = path?.at(-1)?.predicates[0]

                    if (emptyTerm && predicate) {
                      props.nodeDataPointer.addOut(predicate, emptyTerm)
                      update()
                    }
                  }}
                >
                  <Localized id="add">Add</Localized>
                </button>
              </div>
            </div>
          </PropertyElement>
        ) : null}
      </div>
    </div>
  ) : null
}
