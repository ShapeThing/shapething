// @ts-check
import { buildOntology } from '@shapething/shacl-renderer/tools'
import { defineConfig } from 'astro/config'
import { writeFile } from 'node:fs/promises'

// https://astro.build/config
export default defineConfig({
  integrations: [
    {
      // The ShapeThing ontology (http://shapething.com/) is built from @shapething/shacl-renderer
      // and served at /index.ttl - functions/_middleware.ts serves it to RDF clients requesting any
      // ontology IRI. Written before the content layer syncs, which reads it for /documentation/ontology.
      name: 'shapething-ontology',
      hooks: {
        'astro:config:setup': async ({ config }) => {
          await writeFile(new URL('index.ttl', config.publicDir), await buildOntology())
        }
      }
    }
  ]
})
