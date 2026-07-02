import factory from '@rdfjs/data-model'
import datasetFactory from '@rdfjs/dataset'
import grapoi from 'grapoi'
import { describe, expect, test } from 'vitest'
import { rdf, sh, xsd } from '../core/namespaces'
import propertyPointerConflictResolution from './propertyPointerConflictResolution'

/**
 * This conflict resolution is about merging property shapes.
 * There is currently no spec that specifies how to deal with this.
 * In the SHACL 1.2 working group we have talked about the idea of conflict resolution.
 */
describe('propertyPointerConflictResolution', () => {

    const pointer = grapoi({
        dataset: datasetFactory.dataset([
            // property 1
            factory.quad(
                factory.namedNode('http://example.org/property1'),
                rdf('type'),
                sh('PropertyShape')
            ),
            factory.quad(
                factory.namedNode('http://example.org/property1'),
                sh('description'),
                factory.literal('This is a description')
            ),
            factory.quad(
                factory.namedNode('http://example.org/property1'),
                sh('order'),
                factory.literal('1', xsd('integer'))
            ),
            factory.quad(
                factory.namedNode('http://example.org/property1'),
                sh('minCount'),
                factory.literal('1', xsd('integer'))
            ),
            factory.quad(
                factory.namedNode('http://example.org/property1'),
                sh('maxCount'),
                factory.literal('1', xsd('integer'))
            ),

            // Property 2
            factory.quad(
                factory.namedNode('http://example.org/property2'),
                rdf('type'),
                sh('PropertyShape')
            ),
            factory.quad(
                factory.namedNode('http://example.org/property2'),
                sh('description'),
                factory.literal('This is a description 2')
            ),
            factory.quad(
                factory.namedNode('http://example.org/property2'),
                sh('order'),
                factory.literal('-10', xsd('integer'))
            ),
            factory.quad(
                factory.namedNode('http://example.org/property2'),
                sh('minCount'),
                factory.literal('2', xsd('integer'))
            ),
            factory.quad(
                factory.namedNode('http://example.org/property2'),
                sh('maxCount'),
                factory.literal('2', xsd('integer'))
            ),
        ]),
        factory,
        terms: [factory.namedNode('http://example.org/property1'), factory.namedNode('http://example.org/property2')]
    })

    const property = propertyPointerConflictResolution(pointer)

    test('sh:description via out()', async () => {
        expect(property.out(sh('description')).term.value).toBe('This is a description 2, This is a description')
    })

    test('sh:minCount via out()', async () => {
        expect(property.out(sh('minCount')).term.value).toBe('2')
    })

    test('sh:maxCount via out()', async () => {
        expect(property.out(sh('maxCount')).term.value).toBe('1')
    })
})
