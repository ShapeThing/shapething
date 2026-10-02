import { astroLoader } from '@shapething/shacl-renderer/astro'
import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'
import { OntologyTermSchema } from './term'

// public/index.ttl is the ShapeThing ontology, written by the ontology integration in astro.config.mjs.
const terms = defineCollection({
  loader: astroLoader({
    shapes: './src/rdf/.shapes/term.ttl',
    data: './public/index.ttl',
    languages: ['en'],
    schemaFile: './src/term.ts'
  }),
  schema: OntologyTermSchema
})

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/pages' }),
  schema: z.object({
    title: z.string()
  })
})

export const collections = { terms, pages }
