import factory from '@rdfjs/data-model'
import { Literal, Term } from '@rdfjs/types'
import grapoi from 'grapoi'
import { describe, expect, test } from 'vitest'
import { ex, queryPrefixes, sh, xsd } from '../core/namespaces'
import { resolveRdfInput } from '../core/resolveRdfInput'
import propertyPointerConflictResolution from './propertyPointerConflictResolution'

const createPointer = async (turtle: string, subjects: Term[]) => {
    const { dataset } = await resolveRdfInput(turtle)
    const pointer = grapoi({ dataset, factory, terms: subjects })
    return propertyPointerConflictResolution(pointer)
}

/**
 * This is a proposal for how to resolve conflicts when multiple property shapes are defined for the same property.
 */
describe('propertyPointerConflictResolution', async () => {
    const pointer1 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:description "This is a description" ;
            sh:order 1 ;
            sh:minCount 1 ;
            sh:maxCount 1 .

        ex:property2 a sh:PropertyShape ;
            sh:description "This is a description 2" ;
            sh:order -10 ;
            sh:minCount 2 ;
            sh:maxCount 2 .
    `, [ex('property1'), ex('property2')])

    test('sh:description via out()', async () => {
        expect(pointer1.out(sh('description')).values).toEqual(['This is a description 2', 'This is a description'])
    })

    test('sh:minCount via out()', async () => {
        expect(pointer1.out(sh('minCount')).term.value).toBe('2')
    })

    test('sh:maxCount via out()', async () => {
        expect(pointer1.out(sh('maxCount')).term.value).toBe('1')
    })

    const pointer2 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:in (ex:a ex:b ex:c) .

        ex:property2 a sh:PropertyShape ;
            sh:in (ex:c ex:d ex:a) .

    `, [ex('property1'), ex('property2')])

    test('sh:in via out()', async () => {
        expect(pointer2.out(sh('in')).values).toEqual([ex('a').value, ex('c').value])
    })

    const pointer3 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:nodeKind sh:IRI .

        ex:property2 a sh:PropertyShape ;
            sh:nodeKind sh:BlankNodeOrIRI .

        ex:property3 a sh:PropertyShape ;
            sh:nodeKind ( sh:IRI ) .
            
    `, [ex('property1'), ex('property2'), ex('property3')])

    test('sh:nodeKind via out()', async () => {
        expect(pointer3.out(sh('nodeKind')).values).toEqual([sh('IRI').value])
    })

    const pointer4 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:nodeKind sh:Literal .

        ex:property2 a sh:PropertyShape ;
            sh:nodeKind sh:BlankNodeOrIRI .

        ex:property3 a sh:PropertyShape ;
            sh:nodeKind ( sh:IRI ) .
            
    `, [ex('property1'), ex('property2'), ex('property3')])

    test('sh:nodeKind conflict via out()', async () => {
        expect(() => pointer4.out(sh('nodeKind')).values).toThrow(`No intersection found for sh:nodeKind: Literal | BlankNode, IRI | IRI`)
    })

    const pointer5 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:class ex:Animal .

        ex:property2 a sh:PropertyShape ;
            sh:class ex:Dog .

        ex:property3 a sh:PropertyShape ;
            sh:class ex:Boxer .

        ex:property4 a sh:PropertyShape ;
            sh:class ex:Cat .
            
        ex:Cat rdfs:subClassOf ex:Animal .
        ex:Dog rdfs:subClassOf ex:Animal .
        ex:Boxer rdfs:subClassOf ex:Dog .

    `, [ex('property1'), ex('property2'), ex('property3'), ex('property4')])

    test('sh:class inheritance via out()', async () => {
        expect(pointer5.out(sh('class')).values).toEqual([ex('Boxer').value, ex('Cat').value])
    })

    const pointer6 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:datatype ex:HumanAge .

        ex:property2 a sh:PropertyShape ;
            sh:datatype xsd:integer .

        ex:HumanAge a rdfs:Datatype ;
            rdfs:subClassOf xsd:integer .

    `, [ex('property1'), ex('property2')])

    test('sh:datatype inheritance via out()', async () => {
        expect(pointer6.out(sh('datatype')).values).toEqual([ex('HumanAge').value])
    })

    const pointer7 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:datatype ex:HumanAge .

        ex:property2 a sh:PropertyShape ;
            sh:datatype xsd:integer .

        ex:property3 a sh:PropertyShape ;
            sh:datatype xsd:float .

        ex:HumanAge a rdfs:Datatype ;
            rdfs:subClassOf xsd:integer .

    `, [ex('property1'), ex('property2'), ex('property3')])

    test('sh:datatype inheritance via out()', async () => {
        expect(() => pointer7.out(sh('datatype')).values).toThrow(`Expected a singular value for datatype but found disjoint values: HumanAge, float`)
    })

    const pointer8 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:minInclusive 9 ;
            sh:maxInclusive 9 .

        ex:property2 a sh:PropertyShape ;
            sh:minInclusive 10 ;
            sh:maxInclusive 10 .

    `, [ex('property1'), ex('property2')])

    test('sh:minInclusive compares numerically instead of lexicographically', async () => {
        const term = pointer8.out(sh('minInclusive')).term as Literal
        expect(term.value).toBe('10')
        expect(term.datatype.value).toBe(xsd('integer').value)
    })

    test('sh:maxInclusive compares numerically instead of lexicographically', async () => {
        const term = pointer8.out(sh('maxInclusive')).term as Literal
        expect(term.value).toBe('9')
        expect(term.datatype.value).toBe(xsd('integer').value)
    })

    const pointer9 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:minExclusive "2020-01-01"^^xsd:date ;
            sh:maxExclusive "2030-01-01"^^xsd:date .

        ex:property2 a sh:PropertyShape ;
            sh:minExclusive "2019-06-15"^^xsd:date ;
            sh:maxExclusive "2025-06-15"^^xsd:date .

    `, [ex('property1'), ex('property2')])

    test('sh:minExclusive keeps the highest typed literal and its datatype', async () => {
        const term = pointer9.out(sh('minExclusive')).term as Literal
        expect(term.value).toBe('2020-01-01')
        expect(term.datatype.value).toBe(xsd('date').value)
    })

    test('sh:maxExclusive keeps the lowest typed literal and its datatype', async () => {
        const term = pointer9.out(sh('maxExclusive')).term as Literal
        expect(term.value).toBe('2025-06-15')
        expect(term.datatype.value).toBe(xsd('date').value)
    })
})
