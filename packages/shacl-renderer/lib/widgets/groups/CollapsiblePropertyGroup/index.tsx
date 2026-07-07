import useResizeObserver from '@react-hook/resize-observer'
import { ReactNode, useContext, useLayoutEffect, useRef, useState } from 'react'
import { getProperties, useGroupHasContents } from '../../../components/groups/PropertyGroup'
import { MemoIcon } from '../../../components/various/Icon'
import { mainContext } from '../../../core/main-context'
import { rdf, sh, stsr } from '../../../core/namespaces'
import Grapoi from '../../../Grapoi'
import { caretIcon } from '../../../helpers/icons'
import { useGroupLabel } from '../../../hooks/useGroupLabel'
import { WidgetProps } from '../../widgets-context'

const isFirstGroup = (shapePointer: Grapoi, property: Grapoi) => {
  const usedGroupPointers = shapePointer
    .out(sh('property'))
    .out(sh('group'))
    .distinct()
    .map((pointer: Grapoi) => pointer)
    .sort((a, b) => {
      const aOrder = parseFloat(a.out(sh('order')).value as string) ?? 0
      const bOrder = parseFloat(b.out(sh('order')).value as string) ?? 0
      return aOrder - bOrder
    })

  const firstLevelGroups = shapePointer
    .node(usedGroupPointers.map((usedGroupPointer: Grapoi) => usedGroupPointer.terms).flat())
    .filter(
      pointer => !pointer.hasOut(sh('group')).term && pointer.hasOut(rdf('type'), stsr('CollapsiblePropertyGroup')).term
    )

  return firstLevelGroups.terms[0]?.equals(property.term)
}

export default function CollapsiblePropertyGroup(props: WidgetProps & { cssClass?: string }) {
  const { property, notifyCount, notifyParent } = props
  const localName = property.term.value.split(/\/|#/g).pop()
  const { data: dataset, mode, shapePointer, facetSearchDataPointer } = useContext(mainContext)
  const { activeInterfaceLanguage } = useContext(mainContext)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const properties = getProperties({
    ...props,
    shapePointer,
    facetSearchDataPointer,
    group: property,
    dataset,
    notifyCount,
    notifyParent,
    activeInterfaceLanguage
  }) as ReactNode[]

  const groupLabelPath = property.out(stsr('groupLabelPath')).list()
  const label = useGroupLabel(property, props.nodeDataPointer)

  const wrapper = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  const [expanded, setExpanded] = useState(() => {
    return isFirstGroup(shapePointer, property) ?? (groupLabelPath && !label ? true : false)
  })

  useLayoutEffect(() => {
    if (!height && content.current?.getBoundingClientRect().height)
      setHeight(content.current.getBoundingClientRect().height)
  }, [content])

  useResizeObserver(content, entry => {
    if (entry.contentRect.height && !isTransitioning && !height) {
      setHeight(entry.contentRect.height)
    }
  })

  const shouldShow = useGroupHasContents(property, shapePointer, props.nodeDataPointer, mode === 'view')

  return shouldShow ? (
    <div
      ref={wrapper}
      className={`collapsible-group ${localName} ${expanded || !height ? 'expanded' : ''} ${height ? 'processed' : ''}`}
      data-term={property.term.value}
    >
      <button
        className="title"
        onClick={() => {
          setIsTransitioning(true)
          setTimeout(() => {
            setExpanded(!expanded)
            wrapper.current?.querySelector('.collapsible-group-contents')?.addEventListener(
              'transitionend',
              () => {
                setIsTransitioning(false)
                wrapper.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              },
              { once: true }
            )
          })
        }}
      >
        <MemoIcon className="iconify" icon={caretIcon} />
        <span className="label">{label}</span>
      </button>
      {/* We render this always, if we would only render when needed, Suspense items would trigger a re-render which conflict with expanding. */}
      <div
        ref={content}
        style={height && (isTransitioning || !expanded) ? { maxHeight: expanded ? height : 0 } : {}}
        className="collapsible-group-contents"
      >
        {properties}
      </div>
    </div>
  ) : null
}
