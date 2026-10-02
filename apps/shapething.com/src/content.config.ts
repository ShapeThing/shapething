import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'
import { propertySchema } from './property'
import { shapethingLoader } from './shapethingLoader'
const context = {
  '@base': 'http://example.com/',
  type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  shape: 'http://www.w3.org/ns/shacl#shapesGraph',
  label: 'http://www.w3.org/2000/01/rdf-schema#label',
  description: 'http://www.w3.org/2000/01/rdf-schema#comment'
}

const properties = defineCollection({
  loader: shapethingLoader({
    shape: './rdf/.shapes/property.ttl',
    data: './rdf/ontology.ttl',
    typesFolder: './',
    context
  }),
  schema: propertySchema
})

const classes = defineCollection({
  loader: shapethingLoader({
    shape: './rdf/.shapes/class.ttl',
    data: './rdf/ontology.ttl',
    typesFolder: './',
    context
  }),
  schema: propertySchema
})

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/pages' }),
  schema: z.object({
    title: z.string()
  })
})

export const collections = { properties, classes, pages }
