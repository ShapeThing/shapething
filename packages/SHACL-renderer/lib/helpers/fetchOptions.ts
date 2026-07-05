import factory from '@rdfjs/data-model'
import { DatasetCore, NamedNode, Quad_Object, Quad_Subject, Term } from '@rdfjs/types'
import { Store } from 'n3'
import { rdfs, sh, skos, stsr } from '../core/namespaces'
import Grapoi from '../Grapoi'
import { language } from './language'

const queries: Map<string, Promise<Term[]>> = new Map()

const processDynamicShacl = async (
  query: string,
  dataset: DatasetCore,
  shapesDataset: DatasetCore,
  endpoint?: Term
) => {
  const { QueryEngine } = await import('@comunica/query-sparql')
  const engine = new QueryEngine()
  const sources = endpoint ? [endpoint.value] : [new Store([...dataset])]
  const response = await engine.queryBindings(query, { sources })
  const bindings = await response.toArray()

  for (const binding of bindings) {
    const label = binding.get('label')
    const value = binding.get('value')

    if (value && label) {
      // We add these labels to the shapes graph.
      shapesDataset.add(factory.quad(value as Quad_Subject, rdfs('label'), label as Quad_Object))
    }
  }

  return [
    ...new Map(bindings.map(binding => [binding.get('value')?.value, binding.get('value') as NamedNode])).values()
  ]
}

const queryOrGetOptions = async (property: Grapoi, dataset: DatasetCore, shapesDataset: DatasetCore) => {
  const usesSparql: Term | undefined = property.out(sh('in')).out(sh('select')).term
  const query = usesSparql?.value

  if (query) {
    if (!queries.has(query)) {
      const endpoint: Term | undefined = property.out(sh('in')).out(stsr('endpoint')).term
      const promise = processDynamicShacl(query, dataset, shapesDataset, endpoint)
      queries.set(query, promise)
    }
    return queries.get(query)
  } else {
    return [...(property.out(sh('in')).list() ?? [])].map((pointer: Grapoi) => pointer.term)
  }
}

export const fetchOptions = ({
  property,
  dataset,
  shapes,
  activeInterfaceLanguage,
  activeContentLanguage,
  dataPointer
}: {
  property: Grapoi
  dataset: DatasetCore
  dataPointer: Grapoi
  shapes: DatasetCore
  activeInterfaceLanguage: string
  activeContentLanguage?: string
}) =>
  queryOrGetOptions(property, dataset, shapes).then(options => {
    return (
      options
        ?.map((term: Term) => {
          const label =
            dataPointer
              ?.node(term)
              .out([skos('prefLabel'), rdfs('label')])
              .best(language([activeInterfaceLanguage, activeContentLanguage, '', '*'])).value ??
            property
              ?.node(term)
              .out([skos('prefLabel'), rdfs('label')])
              .best(language([activeInterfaceLanguage, activeContentLanguage, '', '*'])).value ??
            term.value.split(/#|\//g).pop()!

          return {
            term,
            value: term.value,
            label: label || term.value
          }
        })
        .sort((a: { label: string }, b: { label: string }) => {
          return a.label.localeCompare(b.label, activeInterfaceLanguage, { sensitivity: 'base' })
        }) ?? []
    )
  })
