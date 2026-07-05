import factory from '@rdfjs/data-model'
import ShaclRenderer, { ShaclRendererProps } from '../../components/ShaclRenderer'
import { initContext } from '../../core/main-context'
import { schema, stsr } from '../../core/namespaces'
import { DiffableTerm } from '../../helpers/diffableTerm'

const baseUrl = new URL('/lib/stories/view/', location.href)

export default {
  title: 'Capabilities/View',
  component: ShaclRenderer,
  argTypes: {}
}

export const withShape = {
  args: {
    mode: 'view',
    data: new URL('john.ttl#john', baseUrl),
    targetClass: schema('Person'),
    shapes: new URL('contact-closed-view.ttl', baseUrl)
  } as ShaclRendererProps
}

export const withoutShape = {
  args: {
    mode: 'view',
    data: new URL('john.ttl#john', baseUrl)
  } as ShaclRendererProps
}

export const genericShape = {
  args: {
    mode: 'view',
    data: new URL('foaf.ttl', baseUrl),
    shapes: new URL('generic.ttl', baseUrl),
    showExtraneousPredicates: true,
    shapeSubject: stsr('GenericView')
  } as ShaclRendererProps
}

const diffContext = {
  mode: 'view',
  data: new URL('john.ttl#john', baseUrl),
  targetClass: schema('Person'),
  shapes: new URL('contact-closed-view.ttl', baseUrl)
} as ShaclRendererProps

const context = await initContext(diffContext)

const quads = [...context.data]
const subject = quads[0].subject
const graph = quads[0].graph

const addedTerm: DiffableTerm = factory.literal('Hendrik Pieter Doe')
addedTerm.diffState = 'added'
const addedQuad = factory.quad(subject, schema('name'), addedTerm, graph)
const deletedTerm: DiffableTerm = factory.literal('Hendrik Jan Doe')
const deletedQuad = factory.quad(subject, schema('name'), deletedTerm, graph)
deletedTerm.diffState = 'deleted'
context.data.delete(deletedQuad)
context.data.add(deletedQuad)
context.data.add(addedQuad)
export const diff = {
  args: {
    mode: 'view',
    data: context.data,
    targetClass: schema('Person'),
    shapes: new URL('contact-closed-view.ttl', baseUrl)
  } as ShaclRendererProps
}

export const PersonWithShape = {
  args: {
    mode: 'view',
    data: new URL('john.ttl#john', baseUrl),
    targetClass: schema('Person'),
    shapes: new URL('person.ttl', baseUrl)
  } as ShaclRendererProps
}

export const oneEnglishTerm = {
  args: {
    mode: 'view',
    data: new URL('one-english.ttl', baseUrl),
    shapes: new URL('multilingual.ttl', baseUrl)
  } as ShaclRendererProps
}

export const list = {
  args: {
    mode: 'view',
    data: new URL('list.ttl#thing', baseUrl)
  } as ShaclRendererProps
}
