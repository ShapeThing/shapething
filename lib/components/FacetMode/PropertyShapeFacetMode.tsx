import { useContext } from 'react'
import { mainContext } from '../../core/main-context'
import { sh, stf } from '../../core/namespaces'
import parsePath from '../../helpers/parsePath'
import { setConstraint } from '../../helpers/setConstraint'
import { useWidget } from '../../widgets/widgets-context'
import PropertyElement from '../PropertyElement'
import type { PropertyUiComponentInnerProps } from '../PropertyUiComponent'

export default function PropertyShapeFacetMode(props: PropertyUiComponentInnerProps) {
  const { facetSearchDataPointer } = useContext(mainContext)
  const { nodeDataPointer, property } = props
  const path = parsePath(property.out(sh('path')))
  const facetSearchData = facetSearchDataPointer.executeAll(path)
  const widgetItem = useWidget(stf('facet'))(property, facetSearchData)
  const cssType = widgetItem?.meta.iri.value.split(/#|\//g).pop()?.replace('Editor', '').toLocaleLowerCase()

  const predicate = property.out(sh('path')).term
  const data = nodeDataPointer.out(sh('property')).distinct().hasOut(sh('path'), predicate)

  return widgetItem ? (
    <PropertyElement showColon property={property}>
      <div className={`facet ${cssType}`}>
        {/** @ts-expect-error TODO the types do not match */}
        <widgetItem.Component
          {...props}
          facetSearchData={facetSearchData}
          data={data}
          setConstraint={setConstraint(data)}
          term={property.term}
        />
      </div>
    </PropertyElement>
  ) : null
}
