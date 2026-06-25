import factory from '@rdfjs/data-model'
import datasetFactory from '@rdfjs/dataset'
import { NamedNode, Store } from '@rdfjs/types'
import grapoi from 'grapoi'
import ogs from 'open-graph-scraper-lite'
import { queryPrefixes, sh } from '../../../core/namespaces'
import { needsHttpProxy } from '../../../core/needsHttpProxy'
import Grapoi from '../../../Grapoi'
import { byOrder } from '../../../helpers/byOrder'
import { cachedFetch } from '../../../helpers/cachedFetch'
import { isValidIri } from '../../../helpers/isValidIri'
import { language } from '../../../helpers/language'
import { corsProxy, sparqlQuery } from './helpers'
import { propertyNodeToQuery } from './searchers'

const localCachedFetch = cachedFetch()

type IriPreviewDataFetcher = {
  term: NamedNode
  cid: string
  activeLanguage: string
  source?: string | Store
  nodeQuery?: string
  genericQuery: string
  property: Grapoi
  labelPredicates: NamedNode[]
  imagePredicates: NamedNode[]
}

type IriPreviewData = {
  label?: string
  image?: string
  cacheable: boolean
}

export const labelAndImageFromPointer = (
  pointer: Grapoi,
  {
    labelPredicates,
    imagePredicates,
    activeLanguage
  }: Pick<IriPreviewDataFetcher, 'labelPredicates' | 'imagePredicates' | 'activeLanguage'>
) => {
  const label = pointer.out(labelPredicates).best(language([activeLanguage, '', '*'])).value
  const image = pointer.out(imagePredicates).best(byOrder(imagePredicates)).value
  return { label, image }
}

const iriWithoutEndpointOpenGraph = async ({ term }: IriPreviewDataFetcher): Promise<IriPreviewData> => {
  const termNeedsProxy = term?.value ? await needsHttpProxy(term.value, localCachedFetch) : false
  const html = await localCachedFetch(`${termNeedsProxy ? corsProxy : ''}${term.value}`)
    .then(res => res.text())
    .catch(() => '')
  if (!html)
    return {
      cacheable: false
    }
  const ogData = await ogs({ html })
  return { label: ogData.result.ogTitle, image: ogData.result.ogImage?.[0]?.url, cacheable: true }
}

const iriWithoutEndpointComunica = async (options: IriPreviewDataFetcher): Promise<IriPreviewData> => {
  if (!isValidIri(options.term.value)) return { cacheable: false }
  const quads = await sparqlQuery(options.term.value, options.genericQuery)
  const pointer = grapoi({ dataset: datasetFactory.dataset(quads), factory, term: options.term })
  return { ...labelAndImageFromPointer(pointer, options), cacheable: true }
}

const iriFromDataset = async (options: IriPreviewDataFetcher): Promise<IriPreviewData> => {
  const { source, genericQuery, nodeQuery, term } = options
  if (typeof source === 'string' || !source) return { cacheable: false }
  const quads = await sparqlQuery(source, nodeQuery ?? genericQuery)
  const pointer = grapoi({ dataset: datasetFactory.dataset(quads), factory, term })
  return { ...labelAndImageFromPointer(pointer, options), cacheable: false }
}

const iriFromSparqlEndpoint = async (options: IriPreviewDataFetcher): Promise<IriPreviewData> => {
  if (!isValidIri(options.term.value) || !options.source || typeof options.source !== 'string')
    return { cacheable: false }
  const quads = await sparqlQuery(options.source, options.nodeQuery ?? options.genericQuery)
  const pointer = grapoi({ dataset: datasetFactory.dataset(quads), factory, term: options.term })
  return { ...labelAndImageFromPointer(pointer, options), cacheable: true }
}

const iriFetchers = [iriFromDataset, iriFromSparqlEndpoint, iriWithoutEndpointComunica, iriWithoutEndpointOpenGraph]

const iriFetchCache = new Map()

/**
 * Situations for fetching image and label:
 * Lets session cache the results
 *
 * - A IRI without endpoint
 * - A IRI from the dataset
 * - A IRI from a endpoint
 *   - set via: `stsr:endpoint`
 *     - SPARQL endpoint via URL
 *     - RDF/js store <urn:store:STORE_NAME>
 *     - file reference <./countries.ttl>
 */
export const iriFetch = (options: Omit<IriPreviewDataFetcher, 'genericQuery' | 'nodeQuery'>) => {
  const { term, labelPredicates, imagePredicates, cid, property } = options
  if (term.value === '') return { label: undefined, image: undefined }

  // Odd, th optional in RDFjs in Comunica is not working,
  // that is why we use the union here.
  // Seems I have once encountered this before.
  // https://github.com/comunica/comunica/issues/1095
  const genericQuery =
    queryPrefixes +
    '\n' +
    `construct {
        <${term.value}> ?labelPredicate ?label .
        <${term.value}> ?imagePredicate ?image .
      } where {
        {
          <${term.value}> ?labelPredicate ?label .
          filter(?labelPredicate in (${labelPredicates.map(i => `<${i.value}>`).join(', ')}))
        }
        union {
          <${term.value}> ?imagePredicate ?image .
          filter(?imagePredicate in (${imagePredicates.map(i => `<${i.value}>`).join(', ')}))
        }
      }
    `

  const nodeQuery = property.out(sh('node')).term ? propertyNodeToQuery(property, term as NamedNode) : undefined

  const createPromise = async () => {
    const localStorageCache = JSON.parse(localStorage.getItem(cid) ?? '{}')
    if (localStorageCache.label && localStorageCache.label !== options.term.value) return localStorageCache

    console.log('starting with:', options.term.value)

    let label,
      image = undefined,
      cacheable = false
    for (const iriFetcher of iriFetchers) {
      if (label && image) continue
      try {
        const {
          label: newLabel,
          image: newImage,
          cacheable: newCacheable
        } = await iriFetcher({ ...options, genericQuery, nodeQuery })
        label = label ?? newLabel
        image = image ?? newImage
        cacheable = newCacheable
      } catch (exception) {
        console.error('Error fetching IRI data:', exception)
      }
    }

    label = label ?? options.term.value

    if (cacheable) localStorage.setItem(cid, JSON.stringify({ label, image, cacheable }))

    return { label, image }
  }

  if (!iriFetchCache.has(options.term.value)) {
    const promise = createPromise()
    iriFetchCache.set(options.term.value, promise)
  }
  return iriFetchCache.get(options.term.value)
}
