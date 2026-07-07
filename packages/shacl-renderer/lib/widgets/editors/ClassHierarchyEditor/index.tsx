import { Icon } from '@iconify/react/offline'
import { Bindings, NamedNode } from '@rdfjs/types'
import { debounce } from 'lodash-es'
import { useContext, useEffect, useState } from 'react'
import { sh, stsr } from '../../../core/namespaces'
import { WidgetProps } from '../../widgets-context'
import TreeView, { NodeId } from './components'

import factory from '@rdfjs/data-model'
import { caretIcon, checkboxChecked, checkboxIndeterminate, checkboxUnchecked } from '../../../helpers/icons'
import parsePath from '../../../helpers/parsePath'

import { QueryEngine } from '@comunica/query-sparql'
import { useLocalStorage } from '@uidotdev/usehooks'
import { languageContext } from '../../../core/language-context'
const queryEngine = new QueryEngine()

type TreeItem = {
  name: string
  id: NodeId
  children: string[]
  parent: string | null
}

const fetchTree = async (endpoint: string, className: string, language: string) => {
  const query = `
  prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
  prefix owl: <http://www.w3.org/2002/07/owl#>
  prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>

  select ?s ?label ?parent (group_concat(str(?child); separator=",") as ?children)
  where {
    ?s rdfs:subClassOf* <${className}> .
    ?s rdfs:label ?label .
    filter(lang(?label) = "${language}" || lang(?label) = "")
    optional {
      ?child rdfs:subClassOf ?s .
    }
    optional {
      ?s rdfs:subClassOf ?parent
    }
  }
  group by ?s ?label ?parent
  `

  const bindingStream = await queryEngine.queryBindings(query, {
    sources: [endpoint],
    lenient: true,
    unionDefaultGraph: true
  })
  const bindings = await bindingStream.toArray()
  return bindings.map((binding: Bindings) => ({
    name: binding.get('label')!.value,
    id: binding.get('s')!.value,
    children: (binding.get('children')?.value.split(',') ?? []).filter(Boolean),
    parent: binding.get('s')!.value === className ? null : (binding.get('parent')?.value ?? null)
  }))
}

const treeCache: Map<string, TreeItem[]> = new Map()

export default function ClassHierarchyEditor({ nodeDataPointer, notifyParent, property }: WidgetProps) {
  const path = parsePath(property.out(sh('path')))!
  const predicate = path[0]?.predicates[0] as NamedNode
  const { activeInterfaceLanguage } = useContext(languageContext)
  const endpoint = property.out(stsr('endpoint')).value
  const className = property.out(sh('class')).value
  const cid = `${className}-${activeInterfaceLanguage}`
  const [tree, setTree] = useState<TreeItem[] | undefined>(treeCache.get(cid))

  useEffect(() => {
    if (!treeCache.has(cid)) {
      fetchTree(endpoint, className, activeInterfaceLanguage).then(data => {
        treeCache.set(cid, data)
        setTree(data)
      })
    } else {
      setTree(treeCache.get(cid))
    }
  }, [activeInterfaceLanguage, endpoint, className])

  const selectedIds = nodeDataPointer.out(predicate).values.filter(Boolean) as NodeId[]
  const [expandedIds, setExpandedIds] = useLocalStorage<NodeId[]>(`class-hierarchy-${property.value}`, selectedIds)

  return tree ? (
    <TreeView
      data={tree}
      aria-label="Checkbox tree"
      multiSelect
      selectedIds={selectedIds}
      expandedIds={expandedIds}
      onExpand={event => {
        setExpandedIds([...event.treeState.expandedIds.values()])
      }}
      propagateSelect
      onSelect={debounce(selected => {
        nodeDataPointer.deleteOut(predicate)
        nodeDataPointer.addOut(
          predicate,
          selected.treeState.selectedIds.values().map((id: string) => factory.namedNode(id))
        )
        notifyParent()
      })}
      propagateSelectUpwards
      togglableSelect
      nodeRenderer={({
        element,
        isBranch,
        isExpanded,
        isSelected,
        isHalfSelected,
        getNodeProps,
        level,
        handleSelect,
        handleExpand
      }) => {
        return (
          <div {...getNodeProps({ onClick: handleExpand })} style={{ marginLeft: 26 * (level - 1) }}>
            {isBranch && (
              <Icon
                icon={caretIcon}
                className={['arrow', !isExpanded && `arrow--closed`, isExpanded && `arrow--open`].join(' ')}
              />
            )}
            <Icon
              className="checkbox-icon"
              onClick={e => {
                handleSelect(e)
                e.stopPropagation()
              }}
              icon={isHalfSelected ? checkboxIndeterminate : isSelected ? checkboxChecked : checkboxUnchecked}
            />
            <span className="name">{element.name}</span>
          </div>
        )
      }}
    />
  ) : (
    <ul className="tree"></ul>
  )
}
