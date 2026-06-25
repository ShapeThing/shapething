/**
 * Generate a TypeScript type via a SHACL shape
 * @module
 */

import type { NamedNode, Quad_Subject } from '@rdfjs/types'
import { ContextParser, JsonLdContextNormalized } from 'jsonld-context-parser'
import { format } from 'prettier'
import * as parserTypeScript from 'prettier/parser-typescript'
import prettierPluginEstree from 'prettier/plugins/estree'
import type { ShaclRendererProps } from '../../components/ShaclRenderer'
import { initContext } from '../../core/main-context'
import { prefixes, rdf, rdfs, sh, stsr, xsd } from '../../core/namespaces'
import { NodeShape, PropertyShape } from '../../core/NodeShape'
import Grapoi from '../../Grapoi'
import { language } from '../../helpers/language'
import parsePath from '../../helpers/parsePath'
import { TransformerOptions } from '../types'

// Translated from https://github.com/rubensworks/rdf-literal.js
const cast = (datatype: NamedNode) => {
  // String types
  if (datatype.equals(xsd('string'))) return 'string'
  if (datatype.equals(xsd('normalizedString'))) return 'string'
  if (datatype.equals(xsd('anyURI'))) return 'string'
  if (datatype.equals(xsd('base64Binary'))) return 'string'
  if (datatype.equals(xsd('language'))) return 'string'
  if (datatype.equals(xsd('Name'))) return 'string'
  if (datatype.equals(xsd('NCName'))) return 'string'
  if (datatype.equals(xsd('NMTOKEN'))) return 'string'
  if (datatype.equals(xsd('token'))) return 'string'
  if (datatype.equals(xsd('hexBinary'))) return 'string'
  if (datatype.equals(rdf('langString'))) return 'string'

  // Boolean type
  if (datatype.equals(xsd('boolean'))) return 'boolean'

  // Number types
  if (datatype.equals(xsd('integer'))) return 'number'
  if (datatype.equals(xsd('long'))) return 'number'
  if (datatype.equals(xsd('int'))) return 'number'
  if (datatype.equals(xsd('byte'))) return 'number'
  if (datatype.equals(xsd('short'))) return 'number'
  if (datatype.equals(xsd('negativeInteger'))) return 'number'
  if (datatype.equals(xsd('nonNegativeInteger'))) return 'number'
  if (datatype.equals(xsd('nonPositiveInteger'))) return 'number'
  if (datatype.equals(xsd('positiveInteger'))) return 'number'
  if (datatype.equals(xsd('unsignedByte'))) return 'number'
  if (datatype.equals(xsd('unsignedInt'))) return 'number'
  if (datatype.equals(xsd('unsignedLong'))) return 'number'
  if (datatype.equals(xsd('unsignedShort'))) return 'number'
  if (datatype.equals(xsd('double'))) return 'number'
  if (datatype.equals(xsd('decimal'))) return 'number'
  if (datatype.equals(xsd('float'))) return 'number'

  // Date types
  if (datatype.equals(xsd('dateTime'))) return 'Date'
  if (datatype.equals(xsd('date'))) return 'Date'
  if (datatype.equals(xsd('gDay'))) return 'Date'
  if (datatype.equals(xsd('gMonthDay'))) return 'Date'
  if (datatype.equals(xsd('gYear'))) return 'Date'
  if (datatype.equals(xsd('gYearMonth'))) return 'Date'

  return 'string'
}

export const commonPrettierOptions = {
  semi: true,
  singleQuote: true,
  printWidth: 10,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'es5'
} as const

/**
 * Creates a TypeScript type for a SHACL shape
 */
export async function toType(
  input: Omit<ShaclRendererProps, 'mode'> & TransformerOptions
): Promise<{ target: NamedNode; type: string } | undefined> {
  const { jsonLdContext, shapes, shapePointer, targetClass } = await initContext({ ...input, mode: 'edit' })

  const myParser = new ContextParser({
    skipValidation: true,
    expandContentTypeToBase: true
  })

  const mergedContext = await myParser.parse({
    ...(input.context ?? {}),
    ...prefixes,
    ...jsonLdContext.getContextRaw()
  })

  if (!targetClass) return undefined

  const nodeShape = new NodeShape({
    shapeSubjects: shapePointer.terms as Quad_Subject[],
    shapesGraph: shapes
  })

  const formatted = shapeToType({
    nodeShape,
    context: mergedContext,
    languageStringsToSingular: input.languageStringsToSingular,
    compactValues: input.compactValues
  })

  const formattedFinal = `export type ${targetClass?.value.split(/\/|#/g).pop()} = ${formatted}`

  const formattedGeneratedCode = await format(formattedFinal, {
    parser: 'typescript',
    plugins: [parserTypeScript, prettierPluginEstree],
    ...commonPrettierOptions,
    printWidth: 80
  })

  return {
    target: targetClass,
    type: formattedGeneratedCode
  }
}

const shapeToType = (options: {
  nodeShape: NodeShape
  context: JsonLdContextNormalized
  languageStringsToSingular?: boolean
  returnType?: true
  compactValues?: boolean
}) => {
  const { nodeShape, context, languageStringsToSingular, compactValues } = options
  const iri = `iri: string;`
  const mustBeIri = nodeShape.shapesPointer.out(sh('nodeKind')).term?.equals(sh('IRI'))

  const props = {
    context,
    compactValues,
    languageStringsToSingular
  }

  const simpleProperties = nodeShape
    .properties()
    .map(property =>
      elementToType({
        ...props,
        property
      })
    )
    .filter(Boolean)
    .join('\n')

  const unions = nodeShape.variants()
  const orUnions = unions
    .filter(union => union[0]?.parentType === 'or')
    .map(union => {
      return union
        .map(part => {
          return part
            .properties()
            .map(property =>
              elementToType({
                ...props,
                property
              })
            )
            .filter(Boolean)
            .join('\n')
        })
        .map(i => `{${i}}`)
        .join(' | ')
    })
    .join(' & ')

  return `{${(mustBeIri ? iri : '') + simpleProperties}} ${orUnions ? `& (${orUnions})` : ''}`
}

const elementToType = (options: {
  property: PropertyShape
  context: JsonLdContextNormalized
  languageStringsToSingular?: boolean
  returnType?: true
  compactValues?: boolean
}): string => {
  const { property, context, languageStringsToSingular, returnType, compactValues } = options
  const pointer = property.shapesPointer as Grapoi
  const path = parsePath(pointer.out(sh('path')) as Grapoi)
  if (!path || !path[0]) throw new Error('Invalid path in property shape')

  const predicate = path[0].predicates[0]
  const compactedPredicate = context.compactIri(predicate.value, true)

  if (path?.[0]?.predicates.length !== 1) return ''

  const comment = pointer
    .out(rdfs('comment'))
    .best(language(['en', '', '*']))
    ?.value?.trim()
  const formattedComment = comment ? `/** ${comment} */\n` : ''

  const datatypeTerm = pointer.out(sh('datatype')).term ?? xsd('string')
  const uniqueLanguage = !!pointer.out(sh('uniqueLang')).value

  let isMultiple = pointer.out(sh('maxCount')).value !== '1'
  if (languageStringsToSingular && uniqueLanguage && datatypeTerm.equals(rdf('langString'))) {
    isMultiple = false
  }

  let dataType = cast(datatypeTerm as NamedNode)
  if (property.parentType === 'not' || pointer.out(sh('maxCount')).value === '0') {
    dataType = 'never'
    isMultiple = false
  }

  const isRequired = pointer.out(sh('minCount')).value && parseInt(pointer.out(sh('minCount')).value) > 0
  const propertyName = ['.', ':'].some(char => compactedPredicate.includes(char))
    ? `'${compactedPredicate}'`
    : compactedPredicate

  let nestedType: string | undefined = undefined

  const props = {
    context,
    languageStringsToSingular,
    compactValues
  }

  if (property.variants().length) {
    const unionParts = property.variants().map(variant => {
      if (variant.properties().length) {
        const subTypes = variant.properties().map(child =>
          elementToType({
            ...props,
            property: child
          })
        )
        return `{${subTypes.join(`\n`)}}`
      } else {
        return elementToType({
          ...props,
          property: variant,
          returnType: true
        })
      }
    })

    nestedType = unionParts.length ? [...new Set(unionParts)].join(' | ') : undefined
  } else if (property.properties().length) {
    const subTypes = property.properties().map(child =>
      elementToType({
        ...props,
        property: child
      })
    )
    nestedType = `{${subTypes.join(`\n`)}}`
  }

  if (property.get(sh('in')).isList()) {
    const listItems = [...property.get(sh('in')).list()]
    nestedType = listItems.map(i => `'${compactValues ? context.compactIri(i.value, true) : i.value}'`).join(' | ')
  }

  // If we use stsr:endpoint we are using nested nodes for autocompletion queries.
  if (property.get(stsr('endpoint')).term) nestedType = undefined

  let type = isMultiple ? `Array<${nestedType || dataType}>` : nestedType || dataType

  const hasValue = pointer.out(sh('hasValue')).value
  if (hasValue) {
    if (compactValues) {
      const compactedValue = context.compactIri(hasValue, true)
      type = `'${compactedValue}'`
    } else {
      type = `'${hasValue}'`
    }
  }

  if (returnType) return type
  return `${formattedComment}${propertyName}${isRequired ? '' : '?'}: ${type}`
}
