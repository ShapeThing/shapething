/* eslint-disable @typescript-eslint/no-explicit-any */
import factory from '@rdfjs/data-model'
import datasetFactory from '@rdfjs/dataset'
import type { BlankNode, DatasetCore, NamedNode, Quad, Quad_Object, Quad_Subject } from '@rdfjs/types'
import grapoi from 'grapoi'
import { ContextParser, JsonLdContextNormalized } from 'jsonld-context-parser'
import { toRdf } from 'rdf-literal'
import { Validator } from 'shacl-engine'
import NormalStorageStrategy from '../../components/EditMode/storage/normal'
import RdfListStorageStrategy from '../../components/EditMode/storage/rdfList'
import { initContext } from '../../core/main-context'
import { dash, prefixes, sh } from '../../core/namespaces'
import { NodeShape, PropertyShape } from '../../core/NodeShape'
import { scoreWidgets } from '../../core/scoreWidgets'
import { isOrderedList } from '../../helpers/isOrderedList'
import { isValidIri } from '../../helpers/isValidIri'
import { coreWidgets } from '../../widgets/coreWidgets'

/**
 * Given a JavaScript object and a SHACL shape, returns RDF quads
 */
export async function dataToRdf(props: {
  data: any
  shapes: URL | DatasetCore | string
  shapeSubject?: NamedNode<string> | BlankNode | undefined
  context?: Record<string, string>
  subject?: NamedNode | BlankNode
  compactValues?: boolean
}): Promise<Quad[]> {
  const { context: givenContext, data } = props

  const mainContext = await initContext({
    shapes: props.shapes,
    shapeSubject: props.shapeSubject,
    context: givenContext,
    mode: 'edit'
  })

  const { jsonLdContext, shapes, shapePointer } = mainContext
  const { subject } = mainContext

  const myParser = new ContextParser({
    skipValidation: true,
    expandContentTypeToBase: true
  })

  const context = await myParser.parse({
    ...prefixes,
    ...jsonLdContext.getContextRaw(),
    ...(givenContext ?? {})
  })

  const activeContentLanguage = Object.keys(mainContext.contentLanguages).length
    ? Object.keys(mainContext.contentLanguages)[0]
    : 'en'

  const store = datasetFactory.dataset()
  const nodeShape = new NodeShape({
    shapesGraph: shapes,
    shapeSubjects: shapePointer.terms as Quad_Subject[]
  })

  await processNode({
    nodeShape,
    store,
    context,
    data,
    widgets: coreWidgets,
    activeContentLanguage,
    subject,
    shapes,
    compactValues: props.compactValues
  })

  return [...store]
}

const processNode = async ({
  nodeShape,
  store,
  context,
  data,
  widgets,
  subject,
  shapes,
  activeContentLanguage,
  compactValues
}: {
  nodeShape: NodeShape
  store: DatasetCore
  context: JsonLdContextNormalized
  data: any
  widgets: typeof coreWidgets
  subject: Quad_Subject
  shapes: DatasetCore
  activeContentLanguage?: string
  compactValues?: boolean
}) => {
  if (nodeShape.variants().length) {
    for (const variant of nodeShape.variants()) {
      const validatedVariantStores = []
      for (const variantShape of variant) {
        const variantStore = datasetFactory.dataset()
        processNode({
          nodeShape: variantShape,
          store: variantStore,
          context,
          data,
          widgets,
          activeContentLanguage,
          subject,
          shapes,
          compactValues
        })

        const validator = new Validator(shapes, { factory })
        const variantShapePointer = variantShape.shapesPointer.node(variantShape.shapesPointer.terms.at(-1))
        const report = await validator.validate({ dataset: variantStore, terms: [subject] }, variantShapePointer)

        // console.log([...variantStore].map(quad => [quad.subject.value, quad.predicate.value, quad.object]))

        if (report.conforms) {
          validatedVariantStores.push(variantStore)
        }
      }

      validatedVariantStores.sort((a, b) => b.size - a.size)
      if (validatedVariantStores[0]) {
        for (const quad of validatedVariantStores[0]) {
          store.add(quad)
        }
      }
    }
  }

  for (const property of nodeShape.properties()) {
    await processProperty({
      property,
      store,
      context,
      data,
      widgets,
      activeContentLanguage,
      subject,
      shapes,
      compactValues
    })
  }
}

const processProperty = async ({
  property,
  store,
  context,
  data,
  widgets,
  subject,
  shapes,
  activeContentLanguage,
  compactValues
}: {
  property: PropertyShape
  store: DatasetCore
  context: JsonLdContextNormalized
  data: any
  widgets: typeof coreWidgets
  subject: Quad_Subject
  shapes: DatasetCore
  activeContentLanguage?: string
  compactValues?: boolean
}) => {
  let path = property.path()
  if (!path) return
  const predicate = path[0]?.predicates[0]
  const compactedPredicate = context.compactIri(predicate.value, true)
  if (!data[compactedPredicate]) return
  const values = Array.isArray(data[compactedPredicate]) ? data[compactedPredicate] : [data[compactedPredicate]]
  const widget = scoreWidgets(widgets['editors'], undefined, property.shapesPointer, dash('editor'))
  if (!widget) return
  const isList = isOrderedList(path)
  if (isList) path = [path[0]]

  const datatype = property.shapesPointer.out(sh('datatype')).term
  const nodeDataPointer = grapoi({ dataset: store, factory, term: subject })

  const storage = isList
    ? new RdfListStorageStrategy(nodeDataPointer, path)
    : new NormalStorageStrategy(nodeDataPointer, path)

  /**
   * When there are variants it means we have an sh:or with multiple sub shapes,
   * these can be node shapes or property shapes.
   */
  if (property.variants().length) {
    const variantStores: DatasetCore[] = []
    for (const variant of property.variants()) {
      const variantStore = datasetFactory.dataset()

      await processProperty({
        property: variant,
        store: variantStore,
        data,
        widgets,
        activeContentLanguage,
        subject,
        context,
        shapes,
        compactValues
      })

      const validator = new Validator(shapes, { factory })
      const dataset = datasetFactory.dataset([...variantStore, ...store])
      const variantShapePointer = variant.shapesPointer.node(variant.shapesPointer.terms.at(-1))
      const subSubject = [...variantStore][0].subject
      const report = await validator.validate({ dataset, terms: [subSubject] }, variantShapePointer)
      if (report.conforms) variantStores.push(variantStore)
    }

    const sortedVariantStores = variantStores.sort((a, b) => b.size - a.size)

    if (sortedVariantStores[0]) {
      for (const quad of sortedVariantStores[0]) store.add(quad)
    }

    return
  }

  const firstValueIsObject = values[0] instanceof Object && !Array.isArray(values[0])

  // Unfortunately we must add terms at once,
  // as the storage abstraction is not good enough yet to keep lists.
  if (firstValueIsObject) {
    storage.addTerms(
      await Promise.all(
        values.map(async value => {
          const blankNode = factory.blankNode()
          for (const subProperty of property.properties()) {
            await processProperty({
              property: subProperty,
              store,
              context,
              data: value,
              widgets,
              activeContentLanguage,
              subject: blankNode,
              shapes,
              compactValues
            })
          }
          return blankNode
        })
      )
    )
  } else {
    storage.addTerms(
      values.map(value => {
        const term = widget.meta.createTerm!({ activeContentLanguage }, property.shapesPointer)
        if (term.termType === 'Literal' && datatype && datatype.termType === 'NamedNode') {
          const newTerm = toRdf(value, { datatype: datatype as NamedNode })
          if (datatype && !newTerm.datatype.equals(datatype)) {
            throw new Error(`Datatype mismatch: expected ${datatype.value}, got ${newTerm.datatype.value}`)
          }
          return newTerm
        }

        if (term.termType === 'NamedNode' && !isValidIri(value)) {
          const expandedTerm = context.expandTerm(value, true)
          if (expandedTerm) term.value = expandedTerm
        }

        if (!term.value) term.value = value

        return term
      }) as Quad_Object[]
    )
  }
}
