import factory from '@rdfjs/data-model'
import { NamedNode } from '@rdfjs/types'
import fs from 'fs'
import grapoi from 'grapoi'
import { describe, expect, test } from 'vitest'
import { getShapes } from './main-context'
import { resolveRdfInput } from './resolveRdfInput'

const baseUrl = `file://${process.cwd()}/lib/core/test-support/`

const contact = new URL('contact.ttl', baseUrl)
const john = new URL('john.ttl', baseUrl)
const academic = new URL('academic.ttl', baseUrl)
const academicData = new URL('academic-data.ttl', baseUrl)
const conditional = new URL('conditional.ttl', baseUrl)
const mixed = new URL('mixed-objects.ttl', baseUrl)
const mixedData = new URL('mixed-objects.ttl', baseUrl)
const john2 = fs.readFileSync(new URL('john.ttl', baseUrl), 'utf8')
const shape2 = fs.readFileSync(new URL('contact-closed.ttl', baseUrl), 'utf8')
const address = new URL('contact.ttl#addressShape', baseUrl)

const input: Array<[URL | string, URL | string | undefined, Array<URL | string>, NamedNode | undefined]> = [
  [contact, undefined, [contact], undefined],
  [contact, john, [contact], undefined],
  [academic, undefined, [new URL('http://example.org/PersonShape')], undefined],
  [
    academic,
    academicData,
    [new URL('http://example.org/PersonShape'), new URL('http://example.org/ResearcherShape')],
    factory.namedNode('http://example.org/alice')
  ],
  [conditional, undefined, [conditional], undefined],
  [mixed, mixedData, [mixed], undefined],
  [shape2, john2, [''], undefined],
  [address, undefined, [address], undefined]
]

describe('getShapes', () => {
  test('getShapes', async () => {
    for (const [shapes, data, terms, givenSubject] of input) {
      const { dataset } = data ? await resolveRdfInput(data) : {}
      const dataPointer = dataset ? grapoi({ dataset, factory }) : undefined
      const shapeData = await getShapes({ shapesInput: shapes, data: dataPointer, givenSubject })
      expect(shapeData.shapePointer?.terms.length).toBe(terms.length)
      expect(terms.map(term => term.toString())).to.be.deep.equal(shapeData.shapePointer?.terms.map(term => term.value))
    }
  })

  test('getShapes with no data but a subject', async () => {
    const shapeData = await getShapes({
      shapesInput: contact,
      givenSubject: factory.namedNode('http://example.org/john')
    })
    expect(shapeData.shapePointer?.terms.length).toBe(1)
    expect(shapeData.shapePointer?.term.value).toBe(contact.toString())
  })
})
