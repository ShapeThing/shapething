import factory from '@rdfjs/data-model'
import datasetFactory from '@rdfjs/dataset'
import type { BlankNode, DatasetCore, NamedNode, Quad_Subject, Term } from '@rdfjs/types'
import grapoi from 'grapoi'
import { JsonLdContextNormalized } from 'jsonld-context-parser'
import { Store } from 'n3'
import { ReactNode, createContext, createElement } from 'react'
import Grapoi from '../Grapoi'
import { dataToRdf } from '../tools/data/dataToRdf'
import { getAllShapes, getFocusNodes } from './getFocusNodes'
import { getShapeSkeleton } from './getShapeSkeleton'
import { prefixes, rdf, rdfs, sh } from './namespaces'
import { Rerenderer } from './Rerenderer'
import { resolveRdfInput } from './resolveRdfInput'

export const NO_SUBJECT_GIVEN = factory.namedNode('urn:no-subject-given')

type FormSubmit = (data: {
  dataset: DatasetCore
  prefixes: Record<string, string>
  dataPointer: Grapoi
  json: object
  context: MainContext
}) => void

export type MainContextInput = {
  shapes?: URL | DatasetCore | string
  shapeSubject?: NamedNode | BlankNode
  data?: URL | DatasetCore | string | object
  languageMode?: 'tabs' | 'individual'
  facetSearchData?: URL | DatasetCore | string
  subject?: NamedNode | BlankNode | Quad_Subject
  prefixes?: Record<string, string>
  targetClass?: NamedNode
  contentLanguages?: Record<string, Record<string, string>>
  interfaceLanguages?: Record<string, Record<string, string>>
  cacheId?: string
  showExtraneousPredicates?: boolean
  activeContentLanguage?: string
  activeInterfaceLanguage?: string
  fallback?: ReactNode
  enableActionPicker?: true
  enableSubjectEditor?: true
  parentSubjects?: Term[]
  activeTabbedGroupIris?: NamedNode[]
  dereferenceCommentsAsDescriptions?: boolean
  store?: Store
  subjectEditLocalNameOnly?: boolean
  context?: Record<string, string>
  onSubmit?: FormSubmit
  children?: (submit: () => void) => ReactNode
  fetch?: (typeof globalThis)['fetch']
  compactValues?: boolean
} & Settings

export type Settings = {
  mode: 'edit' | 'facet' | 'view'
}

export type MainContext = {
  shapes: DatasetCore
  data: DatasetCore
  facetSearchData: DatasetCore
  subject: NamedNode | BlankNode
  shapeSubject?: NamedNode | BlankNode
  targetClass?: NamedNode
  shapePointer: Grapoi
  shapesPointer: Grapoi
  dataPointer: Grapoi
  dereferenceCommentsAsDescriptions: boolean
  showExtraneousPredicates: boolean
  enableActionPicker?: boolean
  activeTabbedGroupIris: NamedNode[]
  enableSubjectEditor?: boolean
  facetSearchDataPointer: Grapoi
  jsonLdContext: JsonLdContextNormalized
  store?: Store
  externalStorePointer: Grapoi
  parentSubjects: Term[]
  fallback?: ReactNode
  languageMode: 'tabs' | 'individual'
  contentLanguages: Record<string, Record<string, string>>
  interfaceLanguages: Record<string, Record<string, string>>
  activeContentLanguage?: string
  subjectEditLocalNameOnly?: boolean
  updates: number
  update: () => void
  rerenderer: Rerenderer
  activeInterfaceLanguage?: string
  originalInput: MainContextInput
  containsRelativeReferences?: boolean
  renameSubject: (newSubject: Quad_Subject) => void
  compactValues?: boolean
} & Settings

// The default context because react needs it this way.
export const mainContext: React.Context<MainContext> = createContext<MainContext>({
  shapes: datasetFactory.dataset(),
  data: datasetFactory.dataset(),
  facetSearchData: datasetFactory.dataset(),
  subject: factory.blankNode(),
  shapeSubject: factory.namedNode(''),
  targetClass: undefined,
  dereferenceCommentsAsDescriptions: false,
  rerenderer: new Rerenderer(),
  activeTabbedGroupIris: [],
  showExtraneousPredicates: false,
  parentSubjects: [],
  shapePointer: undefined as unknown as Grapoi,
  dataPointer: undefined as unknown as Grapoi,
  shapesPointer: undefined as unknown as Grapoi,
  externalStorePointer: undefined as unknown as Grapoi,
  facetSearchDataPointer: undefined as unknown as Grapoi,
  mode: 'edit',
  jsonLdContext: new JsonLdContextNormalized({}),
  languageMode: 'tabs',
  contentLanguages: {},
  interfaceLanguages: { en: { en: 'English' } },
  renameSubject: () => null,
  updates: 0,
  update: () => null,
  originalInput: null as unknown as MainContextInput,
  compactValues: false
})

/**
 * Fetches the data, returns an empty dataset if no data was given.
 */
const getData = async (
  dataInput?: URL | DatasetCore | string,
  subject?: NamedNode | BlankNode,
  fetch?: (typeof globalThis)['fetch']
) => {
  const resolvedData = dataInput ? await resolveRdfInput(dataInput, false, fetch) : null
  const dataset = resolvedData ? resolvedData.dataset : datasetFactory.dataset()

  if (!subject && dataInput instanceof URL) {
    const localDataName = `${dataInput.pathname}${dataInput.hash}`.split('.ttl').pop()!.split('#').pop()
    if (localDataName) subject = factory.namedNode(dataInput.toString())
  }

  const firstQuad = [...dataset]?.[0]
  if (!subject && firstQuad) {
    subject = firstQuad.subject as NamedNode
  } else if (!subject) {
    subject = NO_SUBJECT_GIVEN
  }

  const datasetPrefixes: Record<string, string> = {}
  const temporaryJsonLdContext = new JsonLdContextNormalized(prefixes)
  for (const quad of dataset) {
    const terms = [quad.subject, quad.predicate, quad.object]
    for (const term of terms) {
      if (term.termType === 'NamedNode') {
        const compactedIri = temporaryJsonLdContext.compactIri(term.value)
        if (compactedIri !== term.value) {
          const [prefix] = compactedIri.split(':')
          datasetPrefixes[prefix] = prefixes[prefix]
        }
      }
    }
  }

  return {
    dataPointer: grapoi({ dataset, factory, term: subject }),
    prefixes: { ...resolvedData?.prefixes, ...datasetPrefixes },
    subject,
    dataset,
    containsRelativeReferences: resolvedData?.containsRelativeReferences
  }
}

// 2.1.3.2 Class-based Targets (sh:targetClass) and 2.1.3.3 Implicit Class Targets
export const getTargetClassOfShape = (shape: Grapoi): NamedNode | undefined => {
  // This means you can not have a SHACL SHACL shape with implicit targets.
  return (shape.out(sh('targetClass')).term ?? shape.hasOut(rdf('type'), rdfs('Class')).terms[0]) as
    | NamedNode
    | undefined
}

/**
 * TODO spec requires the subClassOf to be in the data graph.
 */
const getShapeIrisByChildShapeIri = (childClassIri: NamedNode, shapes: Grapoi, shapeIris: NamedNode[] = []) => {
  const shape = shapes.node(childClassIri)
  const shapeTargetClass = getTargetClassOfShape(shape)
  const classDefinition = shape.node(shapeTargetClass)
  const parentClass = classDefinition.out(rdfs('subClassOf')).term
  // 2.1.3.2 Class-based Targets (sh:targetClass)
  let parentShape = shapes.node().hasOut(rdf('type'), sh('NodeShape')).hasOut(sh('targetClass'), parentClass)

  // 2.1.3.3 Implicit Class Targets
  if (parentShape.ptrs.length === 0) {
    parentShape = shapes.node(parentClass).hasOut(rdf('type'), sh('NodeShape')).hasOut(rdf('type'), rdfs('Class'))
  }

  if (shapes.ptrs.length && parentShape.term && classDefinition.ptrs.length && parentClass) {
    const termIsAlreadyIncluded = shapeIris.find(iri => iri.equals(parentShape.term))
    if (termIsAlreadyIncluded) {
      console.error(`The term "${termIsAlreadyIncluded.value}" was found twice in the class hierarchy`)
      return shapeIris
    }

    shapeIris.push(parentShape.term as NamedNode)
    getShapeIrisByChildShapeIri(parentShape.term as NamedNode, shapes, shapeIris)
  }

  return shapeIris
}

/**
 * Fetches the shape part, can return a generic shape if none was given
 */
export const getShapes = async ({
  shapesInput,
  shapeSubject,
  givenTargetClass,
  data,
  givenSubject,
  fetch
}: {
  shapesInput: URL | DatasetCore | string | undefined
  shapeSubject?: NamedNode<string> | BlankNode | undefined | Quad_Subject
  givenTargetClass?: NamedNode | undefined
  data?: Grapoi
  givenSubject?: BlankNode | NamedNode
  fetch?: (typeof globalThis)['fetch']
}) => {
  const shapesGraph = data?.out(sh('shapesGraph')).term
  if (!shapesInput && shapesGraph?.value) {
    shapesInput = new URL(shapesGraph.value, location.toString())
  }
  if (!shapeSubject && shapesGraph) shapeSubject = shapesGraph as NamedNode

  const subject = givenSubject?.equals(NO_SUBJECT_GIVEN) ? undefined : givenSubject

  const { dataset: resolvedShapes } = shapesInput
    ? await resolveRdfInput(shapesInput, true, fetch)
    : {
      dataset: datasetFactory.dataset([
        factory.quad(factory.namedNode('urn:shape'), rdf('type'), sh('NodeShape')),
        factory.quad(factory.namedNode('urn:shape'), sh('targetClass'), givenTargetClass!)
      ])
    }

  if (!shapesInput) {
    shapeSubject = factory.namedNode('urn:shape')
  }

  const allShapePointers = getAllShapes(grapoi({ dataset: resolvedShapes, factory }))

  let shapePointers: Grapoi | undefined = undefined

  if (givenTargetClass) {
    shapePointers = allShapePointers.hasOut(rdf('type'), sh('NodeShape')).hasOut(sh('targetClass'), givenTargetClass)
  }

  // We allow urls with #[localName]
  const localShapeName =
    (shapesInput instanceof URL || typeof shapesInput === 'string') && shapesInput?.toString().includes('#')
      ? shapesInput?.toString().split('#').pop()
      : false
  if (shapeSubject === undefined && localShapeName) {
    const newShapeSubject = [...allShapePointers].find(
      pointer => pointer.value.split(/\/|#/g).pop() === localShapeName
    )?.term
    if (newShapeSubject) shapeSubject = newShapeSubject as Quad_Subject
  }

  if (shapeSubject === undefined) {
    for (const term of allShapePointers.terms) {
      if (term.value === shapesInput?.toString()) {
        shapeSubject = term as NamedNode
      }
    }
  }

  const firstShapeTerm = allShapePointers.terms[0]

  if (!firstShapeTerm) throw new Error('No shape pointer(s)')
  if (!shapePointers) {
    shapePointers = allShapePointers.node([firstShapeTerm])
  }

  if (subject && data) {
    const focusNodeMatches = getFocusNodes(allShapePointers, data)
    const subjectShapes = focusNodeMatches.filter(focusNodeMatch =>
      focusNodeMatch.focusNodes.terms.some(term => subject.equals(term))
    )
    shapePointers = shapePointers.node(subjectShapes.flatMap(focusNodeMatch => focusNodeMatch.shapes.terms))
  }

  if (shapeSubject !== undefined) {
    shapePointers = allShapePointers.node(shapeSubject)
  } else if (shapePointers.term) {
    shapeSubject = shapePointers.term as Quad_Subject
  }

  const parents =
    shapePointers?.terms.flatMap(term => [term, ...getShapeIrisByChildShapeIri(term as NamedNode, allShapePointers)]) ??
    []
  shapePointers = allShapePointers.node(parents)
  const targetClass = shapePointers?.out(sh('targetClass')).terms[0] as NamedNode

  if (!shapePointers?.terms.length) throw new Error('No shape pointer(s)')

  return {
    shapePointer: shapePointers,
    shapesPointer: allShapePointers,
    targetClass,
    resolvedShapes,
    shapeSubject
  }
}

/**
 * Creates a new main context. This is a promise, so it should be awaited.
 */
export const initContext = async (originalInput: MainContextInput): Promise<MainContext> => {
  const {
    shapes,
    facetSearchData,
    subject,
    targetClass: givenTargetClass,
    mode,
    context,
    store,
    showExtraneousPredicates,
    fallback,
    languageMode,
    activeTabbedGroupIris,
    prefixes: givenPrefixes,
    interfaceLanguages,
    dereferenceCommentsAsDescriptions,
    enableSubjectEditor,
    parentSubjects,
    activeInterfaceLanguage,
    compactValues,
    enableActionPicker,
    subjectEditLocalNameOnly,
    activeContentLanguage,
    contentLanguages,
    shapeSubject: givenShapeSubject,
    fetch = globalThis['fetch'],
    ...settings
  } = originalInput

  let { data } = originalInput

  const dummyStore = datasetFactory.dataset()

  const dataIsJSON =
    typeof data === 'object' &&
    !(data instanceof URL) &&
    !(data instanceof dummyStore.constructor) &&
    !(data instanceof Store) &&
    !('match' in data)

  // Convert plain object data to a dataset before passing to getData
  if (dataIsJSON) {
    if (!shapes) throw new Error('No shapes given, but data is an object. Please provide shapes.')
    const quads = await dataToRdf({ data, shapes, context })
    data = datasetFactory.dataset(quads)
  }

  const validSubject =
    subject && (subject.termType === 'NamedNode' || subject.termType === 'BlankNode')
      ? (subject as NamedNode | BlankNode)
      : undefined
  const dataObject = await getData(data as URL | DatasetCore | string, validSubject, fetch)

  const { prefixes, containsRelativeReferences, subject: finalSubject } = dataObject

  let { dataset, dataPointer } = dataObject

  const { shapePointer, resolvedShapes, targetClass, shapeSubject, shapesPointer } = await getShapes({
    shapesInput: shapes,
    shapeSubject: givenShapeSubject,
    givenTargetClass,
    data: dataPointer,
    // If the data is a JSON object, the shape fetching will not work, so we use the given subject.
    givenSubject: dataIsJSON || !data ? NO_SUBJECT_GIVEN : finalSubject,
    fetch
  })

  // This is only for facets, it contains a dataset that we will filter through.
  const facetSearchDataset = facetSearchData
    ? (await resolveRdfInput(facetSearchData, true, fetch)).dataset
    : datasetFactory.dataset()
  const facetSearchDataPointer = grapoi({ dataset: facetSearchDataset, factory })
    .hasOut(rdf('type'), targetClass)
    .distinct()

  if (mode === 'facet') {
    // Extract the bare essentials for a shape so that facets can run and add their filters to it.
    dataset = getShapeSkeleton(shapePointer)
    dataPointer = grapoi({ dataset, factory, term: shapePointer.term })
  }

  // The order of Shapes and data are intertwined. We now have the shapes so we will set the subject definitive.
  if (finalSubject) {
    dataPointer = dataPointer.node(finalSubject)
  }

  return {
    shapes: resolvedShapes,
    dataPointer,
    containsRelativeReferences,
    subject: finalSubject,
    targetClass,
    facetSearchData: facetSearchDataset,
    shapePointer,
    languageMode: languageMode ?? 'tabs',
    fallback: fallback ?? createElement('input', { className: 'input' }),
    store: store,
    activeTabbedGroupIris: activeTabbedGroupIris ?? [],
    enableActionPicker,
    dereferenceCommentsAsDescriptions: !!dereferenceCommentsAsDescriptions,
    showExtraneousPredicates: !originalInput.shapes ? true : !!showExtraneousPredicates,
    enableSubjectEditor,
    parentSubjects: parentSubjects ?? [],
    rerenderer: new Rerenderer(),
    subjectEditLocalNameOnly,
    activeContentLanguage,
    activeInterfaceLanguage,
    externalStorePointer: grapoi({ dataset: store ?? datasetFactory.dataset() }),
    shapesPointer,
    facetSearchDataPointer,
    shapeSubject: shapeSubject as NamedNode | BlankNode,
    compactValues,
    contentLanguages: contentLanguages ?? {},
    interfaceLanguages: interfaceLanguages ?? { en: { en: 'English' } },
    jsonLdContext: new JsonLdContextNormalized({ ...(prefixes ?? {}), ...(givenPrefixes ?? {}) }),
    mode,
    updates: 0,
    update: () => null,
    renameSubject: () => null,
    originalInput,
    ...settings,
    data: dataset
  }
}
