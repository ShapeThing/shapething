import factory from '@rdfjs/data-model'
import fs from 'fs'
import grapoi from 'grapoi'
import { expect, test } from 'vitest'
import { getFocusNodes } from './getFocusNodes'
import { resolveRdfInput } from './resolveRdfInput'

const rdf = fs.readFileSync('./lib/core/test-support/shape.ttl', 'utf8')
const { dataset } = await resolveRdfInput(rdf)
const rdfPointer = grapoi({ dataset, factory })
const focusNodeResults = getFocusNodes(rdfPointer.node(), rdfPointer.node())

test('2.1.3.1 Node targets (sh:targetNode)', async () => {
  const focusNodes = focusNodeResults.filter(result => result.type === 'targetNode').map(result => result.focusNodes)
  const shapesIris = focusNodeResults.filter(result => result.type === 'targetNode').map(result => result.shapes.term)

  expect(focusNodes.length).toBe(1)
  expect(focusNodes[0].term.equals(factory.namedNode('#data1'))).toBe(true)
  expect(shapesIris.length).toBe(1)
  expect(shapesIris[0].equals(factory.namedNode('#targetNodeNodeShape'))).toBe(true)
})

test('2.1.3.2 Class-based Targets (sh:targetClass)', async () => {
  const classTarget = focusNodeResults.find(r => r.type === 'targetClass')
  expect(classTarget).toBeDefined()
  expect(classTarget?.focusNodes.term.equals(factory.namedNode('#data2'))).toBe(true)
  expect(classTarget?.shapes.term.equals(factory.namedNode('#targetClassNodeShape'))).toBe(true)
})

test('2.1.3.3 Implicit Class Targets', async () => {
  const implicitClassTarget = focusNodeResults.find(r => r.type === 'implicitClassTarget')
  expect(implicitClassTarget).toBeDefined()
  expect(implicitClassTarget?.focusNodes.term.equals(factory.namedNode('#data3'))).toBe(true)
  expect(implicitClassTarget?.shapes.term.equals(factory.namedNode('#implicitClassShape'))).toBe(true)
})

test('2.1.3.4 Subjects-of targets (sh:targetSubjectsOf)', async () => {
  const subjectsOfTarget = focusNodeResults.find(r => r.type === 'targetSubjectsOf')
  expect(subjectsOfTarget).toBeDefined()
  expect(subjectsOfTarget?.focusNodes.term.equals(factory.namedNode('http://example.org/subject1'))).toBe(true)
  expect(subjectsOfTarget?.shapes.term.equals(factory.namedNode('#subjectsOfShape'))).toBe(true)
})

test('2.1.3.5 Objects-of targets (sh:targetObjectsOf)', async () => {
  const objectsOfTarget = focusNodeResults.find(r => r.type === 'targetObjectsOf')
  expect(objectsOfTarget).toBeDefined()
  expect(objectsOfTarget?.focusNodes.term.equals(factory.namedNode('http://example.org/object1'))).toBe(true)
  expect(objectsOfTarget?.shapes.term.equals(factory.namedNode('#objectsOfShape'))).toBe(true)
})
