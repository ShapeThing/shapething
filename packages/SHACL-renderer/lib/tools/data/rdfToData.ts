/* eslint-disable @typescript-eslint/no-explicit-any */
import factory from '@rdfjs/data-model'
import type { Quad_Subject } from '@rdfjs/types'
import { ContextParser, JsonLdContextNormalized } from 'jsonld-context-parser'
import { fromRdf } from 'rdf-literal'
import { Validator } from 'shacl-engine'
import type { ShaclRendererProps } from '../../components/ShaclRenderer'
import { getFocusNodes } from '../../core/getFocusNodes'
import { initContext, MainContext } from '../../core/main-context'
import { prefixes, rdf, sh, xsd } from '../../core/namespaces'
import { NodeShape, PropertyShape } from '../../core/NodeShape'
import Grapoi from '../../Grapoi'
import { nonNullable } from '../../helpers/nonNullable'
import { TransformerOptions } from '../types'

/**
 * Given an optional SHACL shape and RDF data returns a JavaScript object
 */
export async function rdfToData<Shape extends object>(
  input: Omit<ShaclRendererProps, 'mode'> & TransformerOptions
): Promise<Array<Shape>> {
  const renderContext = await initContext({ ...input, mode: 'edit' })
  const { jsonLdContext, shapePointer, data, shapes, dataPointer, shapeSubject, subject } = renderContext

  const myParser = new ContextParser({
    skipValidation: true,
    expandContentTypeToBase: true
  })

  const context = await myParser.parse({
    ...prefixes,
    ...jsonLdContext.getContextRaw(),
    ...(input.context ?? {})
  })

  const focusNodeMatches = getFocusNodes(shapePointer.node(shapeSubject), dataPointer.node(subject))

  return await Promise.all(
    focusNodeMatches.flatMap(focusNodeMatch =>
      focusNodeMatch.focusNodes.terms.map(async term => {
        const shape = new NodeShape({
          shapesGraph: shapes,
          shapeSubjects: focusNodeMatch.shapes.terms as Quad_Subject[],
          dataGraph: data,
          dataSubjects: [term as Quad_Subject]
        })

        return nodeShapeToData({
          nodeShape: shape,
          context,
          renderContext,
          dataPointer,
          compactValues: input.compactValues,
          activeContentLanguage: input.activeContentLanguage,
          // If there is no shape, we show all properties of the data pointer.
          showExtraneousPredicates: !input.shapes ? true : input.showExtraneousPredicates
        })
      })
    )
  )
}

const nodeShapeToData = async ({
  nodeShape,
  context,
  renderContext,
  dataPointer,
  compactValues,
  showExtraneousPredicates
}: {
  nodeShape: NodeShape
  renderContext: MainContext
  context: JsonLdContextNormalized
  activeContentLanguage?: string
  dataPointer: Grapoi
  compactValues?: boolean
  showExtraneousPredicates?: boolean
}): Promise<any> => {
  const properties = await Promise.all(
    nodeShape
      .properties()
      .map(property =>
        propertyToData({ ...renderContext, dataPointer, property, context, compactValues, showExtraneousPredicates })
      )
      .filter(nonNullable)
  )

  const variantData: any[] = []
  if (nodeShape.variants().length) {
    for (const variant of nodeShape.variants()) {
      for (const variantShape of variant) {
        try {
          const validator = new Validator(nodeShape.shapesPointer.dataset, { factory })
          const variantShapePointer = variantShape.shapesPointer.node(variantShape.shapesPointer.terms.at(-1))

          const report = await validator.validate(
            { dataset: dataPointer.dataset, terms: dataPointer.terms },
            variantShapePointer
          )

          if (report.conforms) {
            variantData.push(
              await nodeShapeToData({
                renderContext,
                nodeShape: variantShape,
                dataPointer,
                context,
                compactValues,
                showExtraneousPredicates: false
              })
            )
          }
        } catch {
          // Swallow errors for now.
        }
      }
    }
    variantData.sort((a, b) => {
      return Object.keys(a[0] ?? {}).length - Object.keys(b[0] ?? {}).length
    })
  }

  const outputObject = Object.assign({}, ...properties)
  if (dataPointer.term.termType === 'NamedNode' && dataPointer.term.value) {
    outputObject.iri = dataPointer.term.value
  }

  if (variantData.length) {
    Object.assign(outputObject, variantData[0])
  }

  return outputObject
}

const propertyToData = async (props: {
  property: PropertyShape
  context: JsonLdContextNormalized
  activeContentLanguage?: string
  dataPointer: Grapoi
  showExtraneousPredicates?: boolean
  compactValues?: boolean
}): Promise<any> => {
  const { property, context, activeContentLanguage, dataPointer, showExtraneousPredicates, compactValues } = props
  if (property.parentType === 'data' && !showExtraneousPredicates) return {}

  const path = property.path()
  if (!path) return undefined

  // For now we can only deal with simple paths.
  if (path?.[0]?.predicates.length !== 1) {
    return {}
  }

  const predicate = path?.[0]?.predicates[0]
  const compactedPredicate = context.compactIri(predicate.value, true)

  const allTerms = dataPointer.executeAll(path).terms
  const terms = activeContentLanguage
    ? allTerms.filter(term => {
        if (!('language' in term) || !term.language) return true
        return term.language === activeContentLanguage
      })
    : allTerms

  /**
   * Variants are a way to handle different shapes for the same property given by sh:or
   */
  if (property.variants().length) {
    const variantData: any[] = []

    for (const variant of property.variants()) {
      try {
        const validator = new Validator(property.shapesPointer.dataset, { factory })
        const variantShapePointer = variant.shapesPointer.node(variant.shapesPointer.terms.at(-1))
        const focusTerms = dataPointer.executeAll(variant.path()).terms
        const report = await validator.validate(
          { dataset: dataPointer.dataset, terms: focusTerms },
          variantShapePointer
        )

        if (report.conforms) {
          variantData.push(
            await propertyToData({ ...props, property: variant, dataPointer, compactValues, showExtraneousPredicates })
          )
        }
      } catch {
        // Swallow errors for now.
      }
    }

    variantData.sort((a, b) => {
      return Object.keys(a[0] ?? {}).length - Object.keys(b[0] ?? {}).length
    })
    return variantData[0]
  }

  /**
   * Default case: we have a single property with a single path.
   */
  const values = await Promise.all(
    terms.map(async term => {
      const pointer = dataPointer.node(term)
      if (term.termType === 'Literal') {
        return fromRdf(term)
      } else if (term.termType === 'NamedNode') {
        return compactValues ? context.compactIri(term.value, true) : term.value
      } else if (term.termType === 'BlankNode') {
        const subProperties = await Promise.all(
          property.properties().map(subProperty =>
            propertyToData({
              ...props,
              property: subProperty,
              dataPointer: pointer,
              compactValues,
              showExtraneousPredicates
            })
          )
        )
        const outputObject = Object.assign({}, ...subProperties)
        if (pointer.term.termType === 'NamedNode' && pointer.term.value) {
          outputObject.iri = pointer.term.value
        }
        return outputObject
      }
    })
  )

  if (!values.length) return {}

  let multiple = property.shapesPointer.out(sh('maxCount')).value !== '1'
  const datatypeTerm = property.shapesPointer.out(sh('datatype')).term ?? xsd('string')
  const uniqueLanguage = !!property.shapesPointer.out(sh('uniqueLang')).value
  if (activeContentLanguage && datatypeTerm.equals(rdf('langString')) && uniqueLanguage) multiple = false

  return {
    [compactedPredicate]: multiple ? values : values[0]
  }
}
