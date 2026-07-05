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
 * A big chunk of the below tests are written with help of LLM Claude code.
 * They are all manually checked.
 *
 * The tests below follow the exact same order as the `resolutions` map in propertyPointerConflictResolution.ts.
 * Each pointer is declared right before the test(s) that use it, so no pointer is shared across a gap.
 */
describe('propertyPointerConflictResolution', async () => {
    const pointer1 = await createPointer(`
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
        expect(pointer1.out(sh('class')).values).toEqual([ex('Boxer').value, ex('Cat').value])
    })

    const pointer2 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:datatype ex:HumanAge .

        ex:property2 a sh:PropertyShape ;
            sh:datatype xsd:integer .

        ex:HumanAge a rdfs:Datatype ;
            rdfs:subClassOf xsd:integer .

    `, [ex('property1'), ex('property2')])

    test('sh:datatype inheritance via out()', async () => {
        expect(pointer2.out(sh('datatype')).values).toEqual([ex('HumanAge').value])
    })

    const pointer3 = await createPointer(`
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
        expect(() => pointer3.out(sh('datatype')).values).toThrow(`Expected a singular value for datatype but found disjoint values: HumanAge, float`)
    })

    const pointer4 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:nodeKind sh:IRI .

        ex:property2 a sh:PropertyShape ;
            sh:nodeKind sh:BlankNodeOrIRI .

        ex:property3 a sh:PropertyShape ;
            sh:nodeKind ( sh:IRI ) .

    `, [ex('property1'), ex('property2'), ex('property3')])

    test('sh:nodeKind via out()', async () => {
        expect(pointer4.out(sh('nodeKind')).values).toEqual([sh('IRI').value])
    })

    const pointer5 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:nodeKind sh:Literal .

        ex:property2 a sh:PropertyShape ;
            sh:nodeKind sh:BlankNodeOrIRI .

        ex:property3 a sh:PropertyShape ;
            sh:nodeKind ( sh:IRI ) .

    `, [ex('property1'), ex('property2'), ex('property3')])

    test('sh:nodeKind conflict via out()', async () => {
        expect(() => pointer5.out(sh('nodeKind')).values).toThrow(`No intersection found for sh:nodeKind: Literal | BlankNode, IRI | IRI`)
    })

    const pointer6 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:minCount 1 ;
            sh:maxCount 1 .

        ex:property2 a sh:PropertyShape ;
            sh:minCount 2 ;
            sh:maxCount 2 .
    `, [ex('property1'), ex('property2')])

    test('sh:minCount via out()', async () => {
        expect(pointer6.out(sh('minCount')).term.value).toBe('2')
    })

    test('sh:maxCount via out()', async () => {
        expect(pointer6.out(sh('maxCount')).term.value).toBe('1')
    })

    const pointer7 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:minExclusive "2020-01-01"^^xsd:date .

        ex:property2 a sh:PropertyShape ;
            sh:minExclusive "2019-06-15"^^xsd:date .
    `, [ex('property1'), ex('property2')])

    test('sh:minExclusive keeps the highest typed literal and its datatype', async () => {
        const term = pointer7.out(sh('minExclusive')).term as Literal
        expect(term.value).toBe('2020-01-01')
        expect(term.datatype.value).toBe(xsd('date').value)
    })

    const pointer8 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:minInclusive 9 .

        ex:property2 a sh:PropertyShape ;
            sh:minInclusive 10 .
    `, [ex('property1'), ex('property2')])

    test('sh:minInclusive compares numerically instead of lexicographically', async () => {
        const term = pointer8.out(sh('minInclusive')).term as Literal
        expect(term.value).toBe('10')
        expect(term.datatype.value).toBe(xsd('integer').value)
    })

    const pointer9 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:maxExclusive "2030-01-01"^^xsd:date .

        ex:property2 a sh:PropertyShape ;
            sh:maxExclusive "2025-06-15"^^xsd:date .
    `, [ex('property1'), ex('property2')])

    test('sh:maxExclusive keeps the lowest typed literal and its datatype', async () => {
        const term = pointer9.out(sh('maxExclusive')).term as Literal
        expect(term.value).toBe('2025-06-15')
        expect(term.datatype.value).toBe(xsd('date').value)
    })

    const pointer10 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:maxInclusive 9 .

        ex:property2 a sh:PropertyShape ;
            sh:maxInclusive 10 .
    `, [ex('property1'), ex('property2')])

    test('sh:maxInclusive compares numerically instead of lexicographically', async () => {
        const term = pointer10.out(sh('maxInclusive')).term as Literal
        expect(term.value).toBe('9')
        expect(term.datatype.value).toBe(xsd('integer').value)
    })

    const pointer11 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:minLength 3 ;
            sh:maxLength 10 .

        ex:property2 a sh:PropertyShape ;
            sh:minLength 5 ;
            sh:maxLength 8 .
    `, [ex('property1'), ex('property2')])

    test('sh:minLength via out() keeps the highest integer', async () => {
        expect(pointer11.out(sh('minLength')).value).toBe('5')
    })

    test('sh:maxLength via out() keeps the lowest integer', async () => {
        expect(pointer11.out(sh('maxLength')).value).toBe('8')
    })

    const pointer12 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:pattern "^[A-Z]" .

        ex:property2 a sh:PropertyShape ;
            sh:pattern "^[A-Z]" .
    `, [ex('property1'), ex('property2')])

    test('sh:pattern via out() keeps an identical pattern unchanged', async () => {
        expect(pointer12.out(sh('pattern')).value).toBe('^[A-Z]')
    })

    const pointer13 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:pattern "^[A-Z]" .

        ex:property2 a sh:PropertyShape ;
            sh:pattern "[0-9]$" .
    `, [ex('property1'), ex('property2')])

    test('sh:pattern via out() combines differing patterns so a value must match all of them', async () => {
        const value = pointer13.out(sh('pattern')).value
        expect(value).toBe('(?=.*(?:^[A-Z]))(?=.*(?:[0-9]$))')
        expect(new RegExp(value).test('A1')).toBe(true)
        expect(new RegExp(value).test('A')).toBe(false)
        expect(new RegExp(value).test('1')).toBe(false)
    })

    const pointer14 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:singleLine true .

        ex:property2 a sh:PropertyShape ;
            sh:singleLine false .
    `, [ex('property1'), ex('property2')])

    test('sh:singleLine via out() resolves to true when any shape says true', async () => {
        expect(pointer14.out(sh('singleLine')).value).toBe('true')
    })

    const pointer15 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:languageIn ( "en" "nl" "de" ) .

        ex:property2 a sh:PropertyShape ;
            sh:languageIn ( "nl" "fr" ) .
    `, [ex('property1'), ex('property2')])

    test('sh:languageIn via out() merges the intersection into a single sh:List', async () => {
        const result = pointer15.out(sh('languageIn'))
        expect(result.isList()).toBe(true)
        expect([...result.list()].map(item => item.term.value)).toEqual(['nl'])
    })

    const pointer16 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:uniqueLang false .

        ex:property2 a sh:PropertyShape ;
            sh:uniqueLang true .
    `, [ex('property1'), ex('property2')])

    test('sh:uniqueLang via out() resolves to true when any shape says true', async () => {
        expect(pointer16.out(sh('uniqueLang')).value).toBe('true')
    })

    const pointer17 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:memberShape ex:shapeA .

        ex:property2 a sh:PropertyShape ;
            sh:memberShape ex:shapeB .
    `, [ex('property1'), ex('property2')])

    test('sh:memberShape via out() keeps every shape reference', async () => {
        expect(pointer17.out(sh('memberShape')).values).toEqual([ex('shapeA').value, ex('shapeB').value])
    })

    const pointer18 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:minListLength 1 ;
            sh:maxListLength 5 .

        ex:property2 a sh:PropertyShape ;
            sh:minListLength 2 ;
            sh:maxListLength 3 .
    `, [ex('property1'), ex('property2')])

    test('sh:minListLength via out() keeps the highest integer', async () => {
        expect(pointer18.out(sh('minListLength')).value).toBe('2')
    })

    test('sh:maxListLength via out() keeps the lowest integer', async () => {
        expect(pointer18.out(sh('maxListLength')).value).toBe('3')
    })

    const pointer19 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:uniqueMembers false .

        ex:property2 a sh:PropertyShape ;
            sh:uniqueMembers false .
    `, [ex('property1'), ex('property2')])

    test('sh:uniqueMembers via out() resolves to false when every shape says false', async () => {
        expect(pointer19.out(sh('uniqueMembers')).value).toBe('false')
    })

    const equalsTurtle = `
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:equals ex:pathA .

        ex:property2 a sh:PropertyShape ;
            sh:equals ex:pathA .
    `

    const pointer20 = await createPointer(equalsTurtle, [ex('property1'), ex('property2')])

    test('sh:equals via out() resolves when every shape targets the same path', async () => {
        expect(pointer20.out(sh('equals')).term.value).toBe(ex('pathA').value)
    })

    test('sh:equals via out() throws when shapes target different paths', async () => {
        const pointer = await createPointer(`
            ${queryPrefixes}

            ex:property1 a sh:PropertyShape ;
                sh:equals ex:pathA .

            ex:property2 a sh:PropertyShape ;
                sh:equals ex:pathB .
        `, [ex('property1'), ex('property2')])

        expect(() => pointer.out(sh('equals')).term).toThrow(
            `Conflicting values for property ${sh('equals').value}: ${ex('pathA').value}, ${ex('pathB').value}`
        )
    })

    const pointer21 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:order 1 ;
            sh:disjoint ex:pathA .

        ex:property2 a sh:PropertyShape ;
            sh:order 2 ;
            sh:disjoint ex:pathB .

        ex:property3 a sh:PropertyShape ;
            sh:order 3 ;
            sh:disjoint ex:pathA .
    `, [ex('property1'), ex('property2'), ex('property3')])

    test('sh:disjoint via out() keeps every distinct path as its own deduplicated value', async () => {
        expect(pointer21.out(sh('disjoint')).values).toEqual([ex('pathA').value, ex('pathB').value])
    })

    const pointer22 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:order 1 ;
            sh:subsetOf ex:pathA .

        ex:property2 a sh:PropertyShape ;
            sh:order 2 ;
            sh:subsetOf ex:pathB .

        ex:property3 a sh:PropertyShape ;
            sh:order 3 ;
            sh:subsetOf ex:pathA .
    `, [ex('property1'), ex('property2'), ex('property3')])

    test('sh:subsetOf via out() keeps every distinct path as its own deduplicated value', async () => {
        expect(pointer22.out(sh('subsetOf')).values).toEqual([ex('pathA').value, ex('pathB').value])
    })

    test('sh:lessThan via out() keeps every distinct path as its own deduplicated value', async () => {
        const pointer = await createPointer(`
            ${queryPrefixes}

            ex:property1 a sh:PropertyShape ;
                sh:order 1 ;
                sh:lessThan ex:pathA .

            ex:property2 a sh:PropertyShape ;
                sh:order 2 ;
                sh:lessThan ex:pathB .
        `, [ex('property1'), ex('property2')])

        expect(pointer.out(sh('lessThan')).values).toEqual([ex('pathA').value, ex('pathB').value])
    })

    test('sh:lessThanOrEquals via out() keeps every distinct path as its own deduplicated value', async () => {
        const pointer = await createPointer(`
            ${queryPrefixes}

            ex:property1 a sh:PropertyShape ;
                sh:order 1 ;
                sh:lessThanOrEquals ex:pathA .

            ex:property2 a sh:PropertyShape ;
                sh:order 2 ;
                sh:lessThanOrEquals ex:pathB .
        `, [ex('property1'), ex('property2')])

        expect(pointer.out(sh('lessThanOrEquals')).values).toEqual([ex('pathA').value, ex('pathB').value])
    })

    const pointer23 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:not ex:shapeA .

        ex:property2 a sh:PropertyShape ;
            sh:not ex:shapeB .
    `, [ex('property1'), ex('property2')])

    test('sh:not via out() keeps every shape reference', async () => {
        expect(pointer23.out(sh('not')).values).toEqual([ex('shapeA').value, ex('shapeB').value])
    })

    const pointer24 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:order 1 ;
            sh:and ( ex:shapeA ex:shapeB ) .

        ex:property2 a sh:PropertyShape ;
            sh:order 2 ;
            sh:and ( ex:shapeB ex:shapeC ) .
    `, [ex('property1'), ex('property2')])

    test('sh:and via out() keeps each list separate', async () => {
        const result = pointer24.out(sh('and'))
        expect(result.terms.length).toBe(2)
        const lists = [...result].map(single => [...single.list()].map(item => item.term.value))
        expect(lists).toEqual([
            [ex('shapeA').value, ex('shapeB').value],
            [ex('shapeB').value, ex('shapeC').value]
        ])
    })

    const pointer25 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:order 1 ;
            sh:or ( ex:shapeA ex:shapeB ) .

        ex:property2 a sh:PropertyShape ;
            sh:order 2 ;
            sh:or ( ex:shapeC ex:shapeD ) .
    `, [ex('property1'), ex('property2')])

    test('sh:or via out() keeps each list separate instead of flattening', async () => {
        const result = pointer25.out(sh('or'))
        expect(result.terms.length).toBe(2)
        const lists = [...result].map(single => [...single.list()].map(item => item.term.value))
        expect(lists).toEqual([
            [ex('shapeA').value, ex('shapeB').value],
            [ex('shapeC').value, ex('shapeD').value]
        ])
    })

    const pointer26 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:order 1 ;
            sh:xone ( ex:shapeA ex:shapeB ) .

        ex:property2 a sh:PropertyShape ;
            sh:order 2 ;
            sh:xone ( ex:shapeC ex:shapeD ) .
    `, [ex('property1'), ex('property2')])

    test('sh:xone via out() keeps each list separate instead of flattening', async () => {
        const result = pointer26.out(sh('xone'))
        expect(result.terms.length).toBe(2)
        const lists = [...result].map(single => [...single.list()].map(item => item.term.value))
        expect(lists).toEqual([
            [ex('shapeA').value, ex('shapeB').value],
            [ex('shapeC').value, ex('shapeD').value]
        ])
    })

    const pointer27 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:node ex:shapeA .

        ex:property2 a sh:PropertyShape ;
            sh:node ex:shapeB .
    `, [ex('property1'), ex('property2')])

    test('sh:node via out() keeps every shape reference', async () => {
        expect(pointer27.out(sh('node')).values).toEqual([ex('shapeA').value, ex('shapeB').value])
    })

    const pointer28 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:property ex:shapeA .

        ex:property2 a sh:PropertyShape ;
            sh:property ex:shapeB .
    `, [ex('property1'), ex('property2')])

    test('sh:property via out() keeps every shape reference', async () => {
        expect(pointer28.out(sh('property')).values).toEqual([ex('shapeA').value, ex('shapeB').value])
    })

    const pointer29 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:someValue ex:shapeA .

        ex:property2 a sh:PropertyShape ;
            sh:someValue ex:shapeB .
    `, [ex('property1'), ex('property2')])

    test('sh:someValue via out() keeps every shape reference', async () => {
        expect(pointer29.out(sh('someValue')).values).toEqual([ex('shapeA').value, ex('shapeB').value])
    })

    const pointer30 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:qualifiedValueShape ex:shapeA ;
            sh:qualifiedMinCount 1 ;
            sh:qualifiedMaxCount 5 .

        ex:property2 a sh:PropertyShape ;
            sh:qualifiedValueShape ex:shapeB ;
            sh:qualifiedMinCount 2 ;
            sh:qualifiedMaxCount 3 .
    `, [ex('property1'), ex('property2')])

    test('sh:qualifiedValueShape via out() keeps every shape reference', async () => {
        expect(pointer30.out(sh('qualifiedValueShape')).values).toEqual([ex('shapeA').value, ex('shapeB').value])
    })

    test('sh:qualifiedMinCount via out() keeps the highest integer', async () => {
        expect(pointer30.out(sh('qualifiedMinCount')).value).toBe('2')
    })

    test('sh:qualifiedMaxCount via out() keeps the lowest integer', async () => {
        expect(pointer30.out(sh('qualifiedMaxCount')).value).toBe('3')
    })

    const pointer31 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:reificationRequired false ;
            sh:closed false .

        ex:property2 a sh:PropertyShape ;
            sh:reificationRequired false ;
            sh:closed false .
    `, [ex('property1'), ex('property2')])

    test('sh:reificationRequired via out() resolves to false when every shape says false', async () => {
        expect(pointer31.out(sh('reificationRequired')).value).toBe('false')
    })

    test('sh:closed via out() resolves to false when every shape says false', async () => {
        expect(pointer31.out(sh('closed')).value).toBe('false')
    })

    const ignoredPropertiesTurtle = `
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:ignoredProperties ( ex:a ex:b ) .

        ex:property2 a sh:PropertyShape ;
            sh:ignoredProperties ( ex:b ex:c ) .
    `

    const pointer32 = await createPointer(ignoredPropertiesTurtle, [ex('property1'), ex('property2')])

    test('sh:ignoredProperties merges lists into a single deduplicated rdf:List', async () => {
        const result = pointer32.out(sh('ignoredProperties'))
        expect(result.isList()).toBe(true)
        expect([...result.list()].map(item => item.term.value)).toEqual([ex('a').value, ex('b').value, ex('c').value])
    })

    test('sh:ignoredProperties resolution does not write into the shapes dataset', async () => {
        const { dataset } = await resolveRdfInput(ignoredPropertiesTurtle)
        const pointer = propertyPointerConflictResolution(grapoi({ dataset, factory, terms: [ex('property1'), ex('property2')] }))
        const sizeBefore = dataset.size

        const result = pointer.out(sh('ignoredProperties'))

        expect(dataset.size).toBe(sizeBefore)
        expect(result.dataset).not.toBe(dataset)
    })

    const pointer33 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:hasValue ex:valueA .

        ex:property2 a sh:PropertyShape ;
            sh:hasValue ex:valueA .
    `, [ex('property1'), ex('property2')])

    test('sh:hasValue via out() resolves when every shape targets the same value', async () => {
        expect(pointer33.out(sh('hasValue')).term.value).toBe(ex('valueA').value)
    })

    test('sh:hasValue via out() throws when shapes target different values', async () => {
        const pointer = await createPointer(`
            ${queryPrefixes}

            ex:property1 a sh:PropertyShape ;
                sh:hasValue ex:valueA .

            ex:property2 a sh:PropertyShape ;
                sh:hasValue ex:valueB .
        `, [ex('property1'), ex('property2')])

        expect(() => pointer.out(sh('hasValue')).term).toThrow(
            `Expected a singular value for hasValue but found disjoint values: valueA, valueB`
        )
    })

    const pointer34 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:in (ex:a ex:b ex:c) .

        ex:property2 a sh:PropertyShape ;
            sh:in (ex:c ex:d ex:a) .

    `, [ex('property1'), ex('property2')])

    test('sh:in via out() merges the intersection into a single sh:List', async () => {
        const result = pointer34.out(sh('in'))
        expect(result.isList()).toBe(true)
        expect([...result.list()].map(item => item.term.value)).toEqual([ex('a').value, ex('c').value])
    })

    const pointer35 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:rootClass ex:Animal .

        ex:property2 a sh:PropertyShape ;
            sh:rootClass ex:Dog .

        ex:property3 a sh:PropertyShape ;
            sh:rootClass ex:Boxer .

        ex:property4 a sh:PropertyShape ;
            sh:rootClass ex:Cat .

        ex:Cat rdfs:subClassOf ex:Animal .
        ex:Dog rdfs:subClassOf ex:Animal .
        ex:Boxer rdfs:subClassOf ex:Dog .
    `, [ex('property1'), ex('property2'), ex('property3'), ex('property4')])

    test('sh:rootClass via out() keeps only the most specific root classes', async () => {
        expect(pointer35.out(sh('rootClass')).values).toEqual([ex('Boxer').value, ex('Cat').value])
    })

    const pointer36 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:uniqueValuesFor ( ex:a ex:b ) .

        ex:property2 a sh:PropertyShape ;
            sh:uniqueValuesFor ( ex:b ex:c ) .
    `, [ex('property1'), ex('property2')])

    test('sh:uniqueValuesFor via out() merges lists into a single deduplicated rdf:List', async () => {
        const result = pointer36.out(sh('uniqueValuesFor'))
        expect(result.isList()).toBe(true)
        expect([...result.list()].map(item => item.term.value)).toEqual([ex('a').value, ex('b').value, ex('c').value])
    })

    const pointer37 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:order 5 ;
            sh:name "Second name" .

        ex:property2 a sh:PropertyShape ;
            sh:order 1 ;
            sh:name "First name" .
    `, [ex('property1'), ex('property2')])

    test('sh:name via out() keeps the value from the lowest sh:order shape', async () => {
        expect(pointer37.out(sh('name')).value).toBe('First name')
    })

    const pointer38 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:order 1 ;
            sh:description "This is a description" .

        ex:property2 a sh:PropertyShape ;
            sh:order -10 ;
            sh:description "This is a description 2" .
    `, [ex('property1'), ex('property2')])

    test('sh:description via out()', async () => {
        expect(pointer38.out(sh('description')).values).toEqual(['This is a description 2', 'This is a description'])
    })

    const pointer39 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:intent "Intent 1" ;
            sh:agentInstruction "Instruction 1" .

        ex:property2 a sh:PropertyShape ;
            sh:intent "Intent 2" ;
            sh:agentInstruction "Instruction 2" .
    `, [ex('property1'), ex('property2')])

    test('sh:intent via out() keeps every value', async () => {
        expect(pointer39.out(sh('intent')).values.toSorted()).toEqual(['Intent 1', 'Intent 2'])
    })

    test('sh:agentInstruction via out() keeps every value', async () => {
        expect(pointer39.out(sh('agentInstruction')).values.toSorted()).toEqual(['Instruction 1', 'Instruction 2'])
    })

    const pointer40 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:order 5 ;
            sh:codeIdentifier "secondIdentifier" .

        ex:property2 a sh:PropertyShape ;
            sh:order 1 ;
            sh:codeIdentifier "firstIdentifier" .
    `, [ex('property1'), ex('property2')])

    test('sh:codeIdentifier via out() keeps the value from the lowest sh:order shape', async () => {
        expect(pointer40.out(sh('codeIdentifier')).value).toBe('firstIdentifier')
    })

    const pointer41 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:unit ex:meters .

        ex:property2 a sh:PropertyShape ;
            sh:unit ex:seconds .
    `, [ex('property1'), ex('property2')])

    test('sh:unit via out() keeps every value', async () => {
        expect(pointer41.out(sh('unit')).values.toSorted()).toEqual([ex('meters').value, ex('seconds').value].toSorted())
    })

    const pointer42 = await createPointer(`
        ${queryPrefixes}

        ex:property1 a sh:PropertyShape ;
            sh:order 5 ;
            sh:group ex:groupA .

        ex:property2 a sh:PropertyShape ;
            sh:order 1 ;
            sh:group ex:groupB .
    `, [ex('property1'), ex('property2')])

    test('sh:order via out() keeps the lowest integer', async () => {
        expect(pointer42.out(sh('order')).value).toBe('1')
    })

    test('sh:group via out() keeps the value from the lowest sh:order shape, so a property is never shown in two groups', async () => {
        expect(pointer42.out(sh('group')).value).toBe(ex('groupB').value)
    })
})
