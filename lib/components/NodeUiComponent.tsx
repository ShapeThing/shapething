import factory from '@rdfjs/data-model'
import type { DatasetCore, Quad_Subject } from '@rdfjs/types'
import grapoi from 'grapoi'
import { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { languageContext } from '../core/language-context'
import { mainContext } from '../core/main-context'
import { rdf, rdfs, sh, xsd } from '../core/namespaces'
import { scoreWidgets } from '../core/scoreWidgets'
import { TabbedPropertyGroupContextProvider } from '../core/tabbedPropertyGroupContextProvider'
import Grapoi from '../Grapoi'
import { language } from '../helpers/language'
import { nonNullable } from '../helpers/nonNullable'
import parsePath from '../helpers/parsePath'
import resolvePropertyPointerConflicts from '../helpers/propertyPointerConflictResolution'
import { WidgetItem, widgetsContext } from '../widgets/widgets-context'
import { getConditionalFields } from './getConditionalFields'
import PropertyUiComponent from './PropertyUiComponent'
import { SubjectContextProvider } from './SubjectContextProvider'
import SubjectEditor from './SubjectEditor'

export const getElementHelpers = ({
  shapePointer,
  facetSearchDataPointer,
  dataPointer,
  dataset,
  groups,
  notifyParent,
  notifyCount
}: {
  shapePointer: Grapoi
  facetSearchDataPointer: Grapoi
  dataPointer: Grapoi
  dataset: DatasetCore
  groups: WidgetItem[]
  notifyCount: number
  notifyParent: () => void
}) => {
  const keyPrefix = shapePointer.values.join(',') + ':' + dataPointer.values.join(',') + ':'

  const hasValuePredicatePointers = shapePointer.out(sh('property')).hasOut(sh('hasValue'))
  const hasValuePredicates = hasValuePredicatePointers.out(sh('path')).terms
  const ignoredProperties = [
    ...(shapePointer.out(sh('ignoredProperties')).isList()
      ? [...shapePointer.out(sh('ignoredProperties')).list()].map(pointer => pointer.term)
      : []),
    ...hasValuePredicates
  ]

  for (const hasValuePredicatePointer of hasValuePredicatePointers) {
    const predicate = hasValuePredicatePointer.out(sh('path')).term
    const object = hasValuePredicatePointer.out(sh('hasValue'))
    dataPointer.addOut(predicate, object)
  }

  const mapGroup = (group: Grapoi) => {
    const widget = scoreWidgets(groups, undefined, group)
    if (!widget?.Component) return null

    return [
      parseFloat((group.out(sh('order')).value as string) ?? '0'),
      // @ts-expect-error we use groups and should cleanup this type.
      <widget.Component
        key={keyPrefix + group.term.value}
        nodeDataPointer={dataPointer}
        property={group}
        notifyCount={notifyCount}
        notifyParent={notifyParent}
      />
    ] as [number, ReactNode]
  }

  const mapProperty = (property: Grapoi) => {
    const path = parsePath(property.out(sh('path')))
    const items = dataPointer.executeAll(path)
    const pathPredicates = path?.flatMap(part => part?.predicates).filter(nonNullable) ?? []

    return ignoredProperties.some(term => pathPredicates.some(pathPredicate => pathPredicate.equals(term)))
      ? null
      : ([
        parseFloat((property.out(sh('order')).value as string) ?? '0'),
        <PropertyUiComponent
          dataset={dataset}
          notifyParent={notifyParent}
          key={keyPrefix + property.terms.map(term => term.value).join(',')}
          facetSearchDataPointer={facetSearchDataPointer}
          nodeDataPointer={dataPointer}
          notifyCount={notifyCount}
          property={resolvePropertyPointerConflicts(property)}
        />,
        items.ptrs.length > 0,
        property
      ] as [number, ReactNode, boolean, Grapoi])
  }
  return { mapGroup, mapProperty }
}

export default function NodeUiComponent() {
  const {
    shapePointer,
    mode,
    dataPointer,
    facetSearchDataPointer,
    data: dataset,
    shapes,
    showExtraneousPredicates
  } = useContext(mainContext)
  const properties: Grapoi[] = filteredPropertiesFromShape(shapePointer)

  const groups = [...shapePointer.node().hasOut(rdf('type'), sh('PropertyGroup'))]
  const [notifyCount, notify] = useState(0)

  const topLevelGroups = groups.filter(group => !group.hasOut(sh('group')).term)

  const missingGroupDefinitions = properties.filter(pointer => {
    const result = pointer.out(sh('group'))
      .distinct()
      .terms.filter(term => !groups.some(group => group.term.equals(term)))
    return result.length > 0
  })

  if (missingGroupDefinitions.length) {
    throw new Error(`Missing group definitions for: ${missingGroupDefinitions.map(term => term.value).join(', ')}`)
  }

  const topLevelProperties = [...properties.filter(pointer => !pointer.out(sh('group')).term)]
  const usedPredicates = [...properties]
    .flatMap((property: Grapoi) => {
      const parsedPath = parsePath(property.out(sh('path')))
      return parsedPath?.flatMap(part => part?.predicates).filter(nonNullable)
    })
    .map(i => i?.value)
    .filter(nonNullable)

  // We only have sh:or on nodeShapes, this can not exist inside a group.
  // It is possible to have conditional fields in a group but they must be set on the node shape.
  const [conditionalFieldsPointers, setConditionalFieldsPointers] = useState<Grapoi[]>([])

  useEffect(() => {
    const conditionalFields = shapePointer.out(sh('or')).terms
    getConditionalFields({ conditionalFields, dataset, dataPointer, shapePointer, usedPredicates }).then(
      setConditionalFieldsPointers
    )
  }, [notifyCount])

  // Shape has `sh:closed: true`: extra predicates give validation errors
  // Shape no `sh:closed` or `sh:closed: false`: extra predicates are allowed
  // We need an ignore and do not show mode.
  const predicatesWithoutShapes = new Map(
    showExtraneousPredicates
      ? [...dataPointer.out().quads()]
        .filter(quad => !usedPredicates.includes(quad.predicate.value))
        .map(quad => [quad.predicate.value, quad.predicate])
      : []
  )

  const propertiesWithoutShapes: Grapoi[] = [...predicatesWithoutShapes.values()].map(predicate => {
    const propertyIri = factory.namedNode(`int:${predicate.value}`)

    const quads = [
      factory.quad(factory.namedNode(''), sh('property'), propertyIri),
      factory.quad(propertyIri, rdf('type'), sh('PropertyShape')),
      factory.quad(propertyIri, sh('path'), predicate)
    ]
    for (const quad of quads) shapes.add(quad)
    return grapoi({ dataset: shapes, factory, term: propertyIri })
  })
  const { groups: groupWidgets } = useContext(widgetsContext)

  const notifyParent = useCallback(() => notify(notifyCount + 1), [notifyCount, notify])

  const { mapGroup, mapProperty } = useMemo(
    () =>
      getElementHelpers({
        shapePointer,
        dataPointer,
        facetSearchDataPointer,
        dataset,
        groups: groupWidgets,
        notifyCount,
        notifyParent: notifyParent
      }),
    [shapePointer, dataPointer, facetSearchDataPointer, dataset, groupWidgets, notifyCount, notifyParent]
  )

  const formElements: ReactNode[] = [
    ...[
      ...topLevelGroups.map(mapGroup),
      ...conditionalFieldsPointers.map(mapProperty),
      ...topLevelProperties.map(mapProperty),
      ...propertiesWithoutShapes.map(mapProperty)
    ]
      .filter(nonNullable)
      .sort((a, b) => a[0] - b[0])
      .map(([, element]) => element)
  ]

  const { activeInterfaceLanguage } = useContext(languageContext)
  const description = shapePointer
    .out([sh('description'), rdfs('comment')])
    .best(language([activeInterfaceLanguage, '', '*'])).value

  return (
    <TabbedPropertyGroupContextProvider>
      <SubjectContextProvider subject={dataPointer.term as Quad_Subject}>
        <div className="node" data-term={shapePointer.values}>
          {description && ['edit'].includes(mode) ? (
            <div
              className="node-description"
              dangerouslySetInnerHTML={{ __html: description.replaceAll('\n', '<br />') }}
            ></div>
          ) : null}
          <SubjectEditor />
          {formElements}
        </div>
      </SubjectContextProvider>
    </TabbedPropertyGroupContextProvider>
  )
}

/**
 * This logic does two things, first it filters some easy things such as deactivated properties,
 * and second it handles cases where multiple properties share the same path.
 */
export const filteredPropertiesFromShape = (shape: Grapoi) => {
  const properties = shape.out(sh('property')).filter((pointer: Grapoi) => {
    return !pointer.hasOut(sh('deactivated'), factory.literal('true', xsd('boolean'))).term
  })

  const paths = properties.map((pointer: Grapoi) => {
    const path = parsePath(pointer.out(sh('path')))
    return [JSON.stringify(path), pointer]
  })

  const mergedProperties = new Map<string, Grapoi[]>()
  for (const [path, pointer] of paths) {
    if (!mergedProperties.has(path)) {
      mergedProperties.set(path, [])
    }
    mergedProperties.get(path)?.push(pointer)
  }

  return [...mergedProperties.values()].map((pointers: Grapoi[]) => {
    return shape.node(pointers.flatMap(pointer => pointer.terms))
  })
}
