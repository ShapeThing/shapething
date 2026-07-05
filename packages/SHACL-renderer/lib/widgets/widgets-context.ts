import type { DatasetCore, NamedNode, Quad, Term } from '@rdfjs/types'
import type { ComponentType, Context, LazyExoticComponent, ReactNode } from 'react'
import { createContext } from 'react'
import { MainContext } from '../core/main-context'
import Grapoi from '../Grapoi'
import { coreWidgets } from './coreWidgets'

export type WidgetItem<T = WidgetProps> = {
  Component: LazyExoticComponent<ComponentType<T>>
  meta: WidgetMeta
}

/**
 * The meta of your widget must use this type.
 */
export type WidgetMeta = {
  score?: (data?: Grapoi, property?: Grapoi) => number | undefined
  createTerm?: (
    {
      activeContentLanguage,
      languageMode
    }: { activeContentLanguage?: string; languageMode?: MainContext['languageMode'] },
    property?: Grapoi
  ) => Term
  iri: NamedNode
  showIfEmpty?: true
  isMultiWidget?: true
  hidePlusButton?: true
  hideEditButton?: true
  noLoadingSkeleton?: true
  singleUnifiedWidget?: boolean
}

export type WidgetsContext = {
  editors: WidgetItem[]
  viewers: WidgetItem[]
  groups: WidgetItem[]
  facets: WidgetItem[]
  lists: WidgetItem<{ items: ReactNode[] }>[]
}

export type AdditionalWidgetConfiguration = {
  header?: () => ReactNode
  displayCriteria?: (term: Term, index: number) => boolean
  deletionCriteria?: (term: Term) => Promise<boolean>
}

export type WidgetProps = {
  data: Grapoi
  dataset: DatasetCore
  setConstraint: (predicate: NamedNode, value: string | number) => void
  property: Grapoi
  quads: Quad[]
  facetSearchData: Grapoi
  externalStorePointer: Grapoi
  term: Term
  nodeDataPointer: Grapoi
  index: number
  setTerm: (term: Term) => void
  useConfigureWidget: (configuration: AdditionalWidgetConfiguration) => void
  notifyCount: number
  notifyParent: () => void
}

export const widgetsContext: Context<WidgetsContext> = createContext<WidgetsContext>(coreWidgets)

import { useContext, useMemo } from 'react'
import { dash, stf } from '../core/namespaces'
import { scoreWidgets } from '../core/scoreWidgets'

// This hook must be colocated with the context else Vite will chunk it separately
// and it will not work properly.
export const useWidget = (predicate: NamedNode = dash('editor')) => {
  const { editors, facets, viewers } = useContext(widgetsContext)

  const widgetTypes = {
    [dash('editor').value]: editors,
    [dash('viewer').value]: viewers,
    [stf('facet').value]: facets
  }

  const widgets = widgetTypes[predicate.value]

  return useMemo(() => {
    return (property: Grapoi, items?: Grapoi) => {
      return scoreWidgets(widgets, items, property, predicate)
    }
  }, [widgets, predicate])
}

export type Widgets = {
  editors: WidgetItem[]
  viewers: WidgetItem[]
  facets: WidgetItem[]
  lists: WidgetItem<{ items: ReactNode[] }>[]
  groups: WidgetItem[]
}
