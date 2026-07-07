import factory from '@rdfjs/data-model'
import datasetFactory from '@rdfjs/dataset'
import type { DatasetCore, Term } from '@rdfjs/types'
import grapoi from 'grapoi'
import { Validator } from 'shacl-engine'
import { sh, xsd } from '../core/namespaces'
import Grapoi from '../Grapoi'
import { nonNullable } from '../helpers/nonNullable'
import { outAll } from '../helpers/outAll'
import parsePath from '../helpers/parsePath'

export const getConditionalFields = ({
  conditionalFields,
  dataset,
  dataPointer,
  shapePointer,
  usedPredicates
}: {
  conditionalFields: Term[]
  dataset: DatasetCore
  dataPointer: Grapoi
  shapePointer: Grapoi
  usedPredicates: string[]
}) => {
  return Promise.all(
    conditionalFields.map(async (conditionalFieldTerm: Term) => {
      const conditionalFieldOptionsPointer = [...shapePointer.node(conditionalFieldTerm).list()]

      return {
        term: conditionalFieldTerm,
        options: await Promise.all(
          conditionalFieldOptionsPointer.map(async conditionalFieldOptionPointer => {
            const shapeQuads = outAll(conditionalFieldOptionPointer)
            const shapeDataset = datasetFactory.dataset(shapeQuads)

            // Filter shape quads on properties that have hasValue.
            // The other properties are not relevant for conditional showing fields.
            const isolatedOptionPointer = grapoi({ dataset: shapeDataset, factory })

            isolatedOptionPointer.hasOut(sh('path')).map((property: Grapoi) => {
              if (!property.out(sh('hasValue')).term) {
                property.addOut(sh('deactivated'), factory.literal('true', xsd('boolean')))
              }
            })

            const validator = new Validator(shapeDataset, { factory })
            const report = await validator.validate({ dataset, terms: [dataPointer.term] })


            const properties = isolatedOptionPointer.out(sh('path')).map((path: Grapoi) => {
              const parsedPath = parsePath(path)
              return dataPointer.executeAll(parsedPath).terms
            }).flat()

            if (process.env.DEBUG_CONDITIONAL) {
              console.log('OPTION', conditionalFieldOptionPointer.out(sh('name')).value, 'errorCount', report.results.length, 'propertyTermCount', properties.length)
              for (const r of report.results) console.log('  violation path=', r.path?.value, 'msg=', r.message?.[0]?.value, 'component=', r.constraintComponent?.value)
            }

            return {
              report,
              errorCount: report.results.length,
              propertyTermCount: properties.length,
              shape: shapePointer.node(conditionalFieldOptionPointer.term)
            }
          })
        )
      }
    })
  ).then(conditionalFields => {
    return (
      conditionalFields
        .map(conditionalField => {
          const sortedAlternatives = conditionalField.options.sort((a, b) => {
            if (a.errorCount !== b.errorCount) {
              return a.errorCount - b.errorCount
            } else {
              return b.propertyTermCount - a.propertyTermCount
            }
          })
          if (sortedAlternatives[0].errorCount === 0) {
            // No errors, use the first alternative
            return sortedAlternatives[0].shape
          } else {
            return undefined
          }
        })
        .filter(nonNullable)
        ?.flatMap(conditionalFieldsPointers => {
          return (
            conditionalFieldsPointers
              .map((alternativePointer: Grapoi) => {
                return (
                  alternativePointer
                    .out(sh('property'))
                    .filter((pointer: Grapoi) => {
                      return !pointer.hasOut(sh('deactivated'), factory.literal('true', xsd('boolean'))).term
                    })
                    .filter(property => {
                      const path = property.out(sh('path'))

                      // For complex property paths we check all predicates.
                      if (path.isList()) {
                        return [...path.list()].some(p => !usedPredicates.includes(p.value))
                      } else {
                        return !usedPredicates.includes(path.term.value)
                      }
                    }) ?? []
                )
              })
              .filter(nonNullable) ?? []
          )
        })
        .flatMap(pointer => pointer.map((i: Grapoi) => i)) ?? []
    )
  })
}
