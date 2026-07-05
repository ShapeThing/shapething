import { constructQuery } from '@hydrofoil/shape-to-query'
import factory from '@rdfjs/data-model'
import datasetFactory from '@rdfjs/dataset'
import { NamedNode, Store } from '@rdfjs/types'
import clownFace, { GraphPointer } from 'clownface'
import grapoi from 'grapoi'
import Grapoi from '../../../Grapoi'
import { queryPrefixes, rdf, sh, xsd } from '../../../core/namespaces'
import { constructQueryToSearch } from '../../../helpers/constructQueryToSearch'
import { outAll } from '../../../helpers/outAll'
import { labelAndImageFromPointer } from './fetchers'
import { sparqlQuery } from './helpers'

type SearcherProps = {
  source: string | Store
  property: Grapoi
  activeLanguage: string
  search: string
  labelPredicates: NamedNode[]
  imagePredicates: NamedNode[]
}

/**
 * Possible sources:
 * 1. source is a string (SPARQL endpoint)
 * 2. source is a Store (default data graph or a third party store)
 *
 * Possible queries:
 * 1. If property has sh:node, construct query to search for the node.
 * 2. If property has sh:class, construct query to search for instances of the class.
 * 3. If property has no sh:node or sh:class, construct a query to search for labels and images.
 * 4. If property has both sh:node and sh:class, construct a query to search for instances of the class with the node.
 */
export const searcher = async (
  options: SearcherProps
): Promise<
  {
    label: string
    image?: string
    iri: NamedNode
  }[]
> => {
  const query = propertyToSearchQuery(options)
  const { source, activeLanguage, labelPredicates, imagePredicates } = options

  const quads = await sparqlQuery(source, query)
  const dataset = datasetFactory.dataset(quads)

  const subjects = new Set([...dataset].map(quad => quad.subject.value))
  const pointer = grapoi({ dataset, factory, terms: [...subjects].map(subject => factory.namedNode(subject)) })

  return pointer.map((item: Grapoi) => {
    const { label, image } = labelAndImageFromPointer(item, {
      labelPredicates,
      imagePredicates,
      activeLanguage
    })
    return {
      label,
      image,
      iri: item.term
    }
  })
}

export const propertyNodeToQuery = (property: Grapoi, term?: NamedNode, classTerm?: NamedNode) => {
  const shapeQuads = outAll(property.out().distinct().out())
  const nodeShapeTerm = shapeQuads?.[0]?.subject

  if (classTerm) {
    const propertyNode = factory.blankNode()

    shapeQuads.push(
      ...[
        factory.quad(nodeShapeTerm, sh('property'), propertyNode),
        factory.quad(propertyNode, sh('path'), rdf('type')),
        factory.quad(propertyNode, sh('hasValue'), classTerm),
        factory.quad(propertyNode, sh('minCount'), factory.literal('1', xsd('integer')))
      ]
    )
  }

  const shapeDataset = datasetFactory.dataset(shapeQuads)
  const shape = clownFace({ dataset: shapeDataset, term: nodeShapeTerm }) as GraphPointer
  return constructQuery(shape, { focusNode: term }).trim()
}

export const propertyToSearchQuery = ({
  property,
  search,
  labelPredicates,
  imagePredicates
}: Pick<SearcherProps, 'property' | 'search' | 'labelPredicates' | 'imagePredicates'>) => {
  const classTerm = property.out(sh('class')).term
  const nodeTerm = property.out(sh('node')).term

  let query: string | undefined
  if (classTerm && nodeTerm) {
    query = constructQueryToSearch(
      propertyNodeToQuery(property, undefined, classTerm as NamedNode),
      search,
      labelPredicates,
      20
    )
  } else if (nodeTerm) {
    query = constructQueryToSearch(propertyNodeToQuery(property), search, labelPredicates, 20)
  } else {
    // If no sh:node and optionally sh:class, construct a query to search for labels and images
    query =
      queryPrefixes +
      '\n' +
      `construct {
          ?iri ?labelPredicate ?label .
          ?iri ?imagePredicate ?image .
          ${classTerm ? `?iri a <${classTerm.value}> .` : ''}
        } where {
          { select ?iri ?labelPredicate ?label where {
            ${classTerm ? `?iri a <${classTerm.value}> .` : ''}
            ?iri ?labelPredicate ?label .
            filter contains(lcase(str(?label)), "${search}")
            filter(?labelPredicate in (${labelPredicates.map(i => `<${i.value}>`).join(', ')}))
            filter (not exists {
              ?iri ?imagePredicate ?image .
              filter(?imagePredicate in (${imagePredicates.map(i => `<${i.value}>`).join(', ')}))
            })
          }}
          union
          { select ?iri ?labelPredicate ?label where {
            ${classTerm ? `?iri a <${classTerm.value}> .` : ''}
            ?iri ?labelPredicate ?label .
            filter contains(lcase(str(?label)), "${search}")
            filter(?labelPredicate in (${labelPredicates.map(i => `<${i.value}>`).join(', ')}))
            ?iri ?imagePredicate ?image .
            filter(?imagePredicate in (${imagePredicates.map(i => `<${i.value}>`).join(', ')}))
          }}
        }
        limit 20`
  }
  return query
}
