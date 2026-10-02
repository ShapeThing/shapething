import { rdfToData } from '@shapething/shacl-renderer/rdfToData'
import { resolveRdfInput } from '@shapething/shacl-renderer/resolveRdfInput'
import { toType } from '@shapething/shacl-renderer/type'
import type { Loader, LoaderContext } from 'astro/loaders'
import { glob } from 'glob'
import { readFile, writeFile } from 'node:fs/promises'
import { generate } from 'ts-to-zod'

type LoaderOptions = {
  // A glob to the file that contain the shape.
  shape: string
  // A glob to all of your data. Shapes may be included but do not need to be.
  data: string
  // A JsonLdContext
  context: Record<string, string>
  // The folder to save the types
  typesFolder: string
}

export function shapethingLoader({
  shape: inputShapes,
  data: inputData,
  context: jsonLdContext,
  typesFolder = './'
}: LoaderOptions): Loader {
  return {
    name: 'shapething',
    load: async ({ store, generateDigest }: LoaderContext): Promise<void> => {
      const dataItems: Record<string, any> = {}
      const [shapeFile] = await glob(`${import.meta.dirname}/${inputShapes}`)
      const schemaName = shapeFile.split('/').pop()?.replace('.ttl', '')!

      const shapesContents = await readFile(shapeFile, 'utf8')
      const typeOutput = await toType({
        shapes: shapesContents,
        context: jsonLdContext,
        languageStringsToSingular: true
      })
      if (!typeOutput) throw new Error('Could not generate type')
      const { dataset: shapes } = await resolveRdfInput(shapesContents, true)

      const dataFiles = await glob(`${import.meta.dirname}/${inputData}`)

      for (const dataFile of dataFiles) {
        const dataContents = await readFile(dataFile, 'utf8')
        const jsData = await rdfToData({
          activeContentLanguage: 'en',
          data: dataContents,
          shapes,
          context: jsonLdContext
        })

        /** @ts-ignore */
        for (const item of jsData) {
          const localName = item.iri.split(/\#|\//g).pop()!
          if (typeOutput.target.value === item.type) {
            dataItems[localName] = item
          }
        }
      }

      const schema = generate({
        getSchemaName: () => schemaName + 'Schema',
        sourceText: typeOutput.type
      })

      const zodFile = schema
        .getZodSchemasFile('./')
        .replace(`import { z } from "zod";`, 'import { z } from "astro:content";')
        .replace(`ts-to-zod`, `ShapeThing`)
      await writeFile(`${import.meta.dirname}/${typesFolder}/${schemaName}.ts`, zodFile)

      for (const [id, data] of Object.entries(dataItems)) {
        store.set({ id, data, digest: generateDigest(data) })
      }
    }
  }
}
