import { dash, sh } from '../../core/namespaces'
import Grapoi from '../../Grapoi'
import { DiffableTerm } from '../../helpers/diffableTerm'
import parsePath from '../../helpers/parsePath'
import { TouchableTerm } from '../../helpers/touchableRdf'
import { wrapWithList } from '../../helpers/wrapWithList'
import { useWidget } from '../../widgets/widgets-context'
import PropertyElement from '../PropertyElement'
import type { PropertyShapeInnerProps } from '../PropertyShape'

export default function PropertyShapeViewMode(props: PropertyShapeInnerProps) {
  const { nodeDataPointer, property } = props
  const path = parsePath(property.out(sh('path')))
  const data = nodeDataPointer.executeAll(path)

  const widgetItem = useWidget(dash('viewer'))(property, data)
  const cssType = widgetItem?.meta.iri.value.split(/#|\//g).pop()?.replace('Editor', '').toLocaleLowerCase()
  if (widgetItem?.meta.isMultiWidget) {
    const quads = [...data.quads()]
    return (
      <PropertyElement cssClass={cssType} showColon property={property}>
        {/* @ts-expect-error types do not match */}
        <widgetItem.Component {...props} key={[...data.quads()].map(i => i.value).join('')} quads={quads} />
      </PropertyElement>
    )
  }

  const finalData = data.isList() ? [...data.list()] : data

  return data.ptrs.length ? (
    <PropertyElement showColon property={property}>
      <div className="property-objects">
        {wrapWithList(
          finalData.map((item: Grapoi) => {
            const widgetItem = useWidget(dash('viewer'))(property, item)
            const cssType = widgetItem?.meta.iri.value.split(/#|\//g).pop()?.replace('Editor', '').toLocaleLowerCase()

            return widgetItem && item.term.value && (item.term as TouchableTerm).touched === undefined ? (
              <div key={item.term.value} className={`${(item.term as DiffableTerm).diffState ?? ''} term ${cssType}`}>
                {/* @ts-expect-error TODO the types do not match */}
                <widgetItem.Component {...props} key={item.term.value} data={item} term={item.term} />
              </div>
            ) : null
          }),
          property
        )}
      </div>
    </PropertyElement>
  ) : null
}
