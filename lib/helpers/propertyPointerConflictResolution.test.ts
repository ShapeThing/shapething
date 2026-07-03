import factory from '@rdfjs/data-model'
import datasetFactory from '@rdfjs/dataset'
import grapoi from 'grapoi'
import { describe, expect, test } from 'vitest'
import { ex, rdf, sh, xsd } from '../core/namespaces'
import propertyPointerConflictResolution from './propertyPointerConflictResolution'

/**
 * This is a proposal for how to resolve conflicts when multiple property shapes are defined for the same property.
 */
describe('propertyPointerConflictResolution', () => {

    const p1 = ex('property1')
    const p2 = ex('property2')

    const pointer = grapoi({
        dataset: datasetFactory.dataset([
            // property 1
            factory.quad(p1, rdf('type'), sh('PropertyShape')),
            factory.quad(p1, sh('description'), factory.literal('This is a description')),
            factory.quad(p1, sh('order'), factory.literal('1', xsd('integer'))),
            factory.quad(p1, sh('minCount'), factory.literal('1', xsd('integer'))),
            factory.quad(p1, sh('maxCount'), factory.literal('1', xsd('integer'))),

            // Property 2
            factory.quad(p2, rdf('type'), sh('PropertyShape')),
            factory.quad(p2, sh('description'), factory.literal('This is a description 2')),
            factory.quad(p2, sh('order'), factory.literal('-10', xsd('integer'))),
            factory.quad(p2, sh('minCount'), factory.literal('2', xsd('integer'))),
            factory.quad(p2, sh('maxCount'), factory.literal('2', xsd('integer'))),
        ]),
        factory,
        terms: [p1, p2]
    })

    const property = propertyPointerConflictResolution(pointer)

    test.only('sh:description via out()', async () => {
        expect(property.out(sh('description')).values).toEqual(['This is a description 2', 'This is a description'])
    })

    test('sh:minCount via out()', async () => {
        expect(property.out(sh('minCount')).term.value).toBe('2')
    })

    test('sh:maxCount via out()', async () => {
        expect(property.out(sh('maxCount')).term.value).toBe('1')
    })
})
