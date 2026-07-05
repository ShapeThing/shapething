/**
 * Generate fake RDF data via a SHACL shape
 * @module
 */

import { faker as fakerLibrary } from '@faker-js/faker'
import factory from '@rdfjs/data-model'
import datasetFactory from '@rdfjs/dataset'
import type { BlankNode, DatasetCore, NamedNode, Quad_Object, Quad_Subject, Term } from '@rdfjs/types'
import grapoi from 'grapoi'
import { toRdf } from 'rdf-literal'
import NormalStorageStrategy from '../../components/EditMode/storage/normal'
import RdfListStorageStrategy from '../../components/EditMode/storage/rdfList'
import { initContext } from '../../core/main-context'
import { dash, faker, sh } from '../../core/namespaces'
import { NodeShape, PropertyShape } from '../../core/NodeShape'
import { scoreWidgets } from '../../core/scoreWidgets'
import { isOrderedList } from '../../helpers/isOrderedList'
import { coreWidgets } from '../../widgets/coreWidgets'
import { Widgets } from '../../widgets/widgets-context'

/**
 * Given a SHACL shape, generates a dummy data resource
 */
export async function generateFake({
  shapes,
  shapeSubject,
  context: givenContext,
  subject,
  seed
}: {
  shapes: URL | DatasetCore | string
  shapeSubject?: NamedNode | BlankNode
  context?: Record<string, string>
  subject?: NamedNode | BlankNode
  seed?: number
}): Promise<DatasetCore> {
  const mainContext = await initContext({
    shapes,
    shapeSubject,
    context: givenContext,
    mode: 'edit'
  })
  const { shapePointer } = mainContext
  const widgets = coreWidgets
  const activeContentLanguage = Object.keys(mainContext.contentLanguages).length
    ? Object.keys(mainContext.contentLanguages)[0]
    : 'en'
  if (!subject) subject = factory.namedNode('#')

  const nodeShape = new NodeShape({
    shapesGraph: mainContext.shapes,
    shapeSubjects: shapePointer.terms as Quad_Subject[]
  })

  const store = datasetFactory.dataset()

  await processNode({
    nodeShape,
    store,
    subject,
    widgets,
    activeContentLanguage,
    seed
  })

  return store
}

const processNode = async ({
  nodeShape,
  store,
  subject,
  widgets,
  activeContentLanguage,
  seed
}: {
  nodeShape: NodeShape
  store: DatasetCore
  subject: NamedNode | BlankNode
  activeContentLanguage: string
  widgets: Widgets
  seed?: number
}) => {
  for (const property of nodeShape.properties()) {
    await processProperty({
      property: property,
      store,
      widgets,
      activeContentLanguage,
      subject,
      seed
    })
  }
}

const processProperty = async ({
  property,
  store,
  widgets,
  activeContentLanguage,
  subject,
  seed
}: {
  property: PropertyShape
  store: DatasetCore
  widgets: Widgets
  activeContentLanguage: string
  subject: NamedNode | BlankNode
  seed?: number
}) => {
  if (property.variants().length) {
    const variantStores: DatasetCore[] = []
    for (const variant of property.variants()) {
      const variantStore = datasetFactory.dataset()
      variantStores.push(variantStore)
      await processProperty({
        property: variant,
        store: variantStore,
        widgets,
        activeContentLanguage,
        subject,
        seed
      })
    }
    const finalStore = variantStores[fakerLibrary.number.int({ min: 0, max: variantStores.length - 1 })]

    for (const quad of finalStore) {
      store.add(quad)
    }

    return
  }

  const widget = scoreWidgets(widgets['editors'], undefined, property.shapesPointer, dash('editor'))
  if (!widget) return
  let path = property.path()
  if (!path) return
  const predicate = path[0]?.predicates[0]
  const fakerPointer = property.get(faker('generator'))
  const fakerSettings = seed ? { refDate: '2020-01-01' } : {}
  const generator = fakerPointer.term
    ? () => {
        const fakerParts = fakerPointer.isList() ? [...fakerPointer.list()].map(i => i.term) : [fakerPointer.term]
        const valueParts = fakerParts.map((fakerPart: Term) => {
          return fakerPart.termType === 'Literal'
            ? fakerPart.value
            : getFakerGenerator(fakerPart.value.substring(20), fakerLibrary)(fakerSettings)
        })

        if (valueParts.length === 1) return valueParts[0]
        return [...valueParts].join('')
      }
    : undefined

  const min = parseInt(property.get(sh('minCount')).value ?? '0')
  const max = parseInt(property.get(sh('maxCount')).value ?? '10')

  const options = (
    property.get(sh('in')).term ? [...property.get(sh('in')).list()].map(pointer => pointer.term) : []
  ) as Quad_Object[]

  const nodeDataPointer = grapoi({ dataset: store, factory, term: subject })
  const isList = isOrderedList(path)
  if (isList) path = [path[0]]

  const storage = isList
    ? new RdfListStorageStrategy(nodeDataPointer, path)
    : new NormalStorageStrategy(nodeDataPointer, path)

  for (let index = 0; index < fakerLibrary.number.int({ min, max }); index++) {
    if (options.length) {
      const value = options[fakerLibrary.number.int({ min: 0, max: options.length - 1 })]
      store.add(factory.quad(subject, predicate, value))
    } else if (property.get(sh('nodeKind')).term?.equals(sh('BlankNode'))) {
      const blankNode = factory.blankNode()
      storage.addTerm(blankNode)

      for (const child of property.properties()) {
        await processProperty({
          property: child,
          store,
          widgets,
          activeContentLanguage,
          subject: blankNode
        })
      }
    } else if (generator) {
      try {
        if (seed) fakerLibrary.seed(seed + index)

        const emptyTerm = widget.meta.createTerm
          ? widget.meta.createTerm({ activeContentLanguage })
          : factory.literal('')
        if (emptyTerm.termType === 'Literal') {
          const value = generator()
          const newTerm = toRdf(value)
          storage.addTerm(newTerm)
        } else {
          console.log(generator())
        }
      } catch (error) {
        console.error(error)
      }
    }
  }
}

type FakerValue = string | Date | number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FakerGenerator = (...args: any[]) => FakerValue

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getFakerGenerator = (dotSeparatedString: string, pointer: any): FakerGenerator => {
  const parts = dotSeparatedString.split('.')
  for (const part of parts) pointer = pointer[part]
  if (!pointer) throw new Error(`Could not find faker: ${dotSeparatedString}`)
  return pointer as unknown as FakerGenerator
}
