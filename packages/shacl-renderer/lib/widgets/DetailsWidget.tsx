import factory from '@rdfjs/data-model'
import datasetFactory from '@rdfjs/dataset'
import grapoi from 'grapoi'
import { useContext } from 'react'
import Grapoi from '../Grapoi'
import { MainContextProvider } from '../components/MainContextProvider'
import NodeUiComponent from '../components/NodeUiComponent'
import { languageContext } from '../core/language-context'
import { getTargetClassOfShape, mainContext } from '../core/main-context'
import { rdf, sh } from '../core/namespaces'
import { WidgetProps } from './widgets-context'

export default function DetailsWidget({ data, property, facetSearchData }: WidgetProps) {
  const node = property.out(sh('node')).term
  let shapePointer: Grapoi

  if (!node) {
    const dataset = datasetFactory.dataset([
      factory.quad(factory.namedNode(data?.term.value), rdf('type'), sh('NodeShape'))
    ])
    shapePointer = grapoi({ dataset, factory, term: factory.namedNode(data?.term.value) })
  } else {
    shapePointer = property.node(node)
  }

  const mainContextInstance = useContext(mainContext)
  const targetClass = getTargetClassOfShape(shapePointer)

  const { activeContentLanguage, activeInterfaceLanguage } = useContext(languageContext)

  return (
    <MainContextProvider
      context={{
        ...mainContextInstance,
        targetClass: targetClass ?? mainContextInstance.targetClass,
        shapePointer: shapePointer,
        dataPointer: data?.distinct(),
        facetSearchDataPointer: facetSearchData,
        activeContentLanguage,
        activeInterfaceLanguage
      }}
    >
      <NodeUiComponent />
    </MainContextProvider>
  )
}
