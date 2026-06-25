import { write } from '@jeswr/pretty-turtle/dist'
import fs from 'fs'
import { expect, test } from 'vitest'
import { prefixes } from '../../core/namespaces'
import { dataToRdf } from './dataToRdf'

const baseUrl = `file://${process.cwd()}/lib/tools/data/test-support/to-rdf/`
const dir = fs.readdirSync(new URL('.', baseUrl))
const filtered = dir.some(folder => folder.endsWith('.only')) ? dir.filter(folder => folder.endsWith('.only')) : dir
const filtered2 = filtered.filter(folder => !folder.endsWith('.skip'))
for (const testFolder of filtered2) {
  if (testFolder.includes('.ttl')) continue
  const testUrl = new URL(`${testFolder}/`, baseUrl)

  const settings = JSON.parse(fs.readFileSync(new URL('settings.json', testUrl), 'utf8'))
  const shapes = fs.existsSync(new URL('shapes.ttl', testUrl))
    ? fs.readFileSync(new URL('shapes.ttl', testUrl), 'utf8')
    : null!
  const data = (await import(new URL('input.ts', testUrl).toString())).default
  const expected = fs.existsSync(new URL('output.ttl', testUrl))
    ? fs.readFileSync(new URL('output.ttl', testUrl), 'utf8')
    : null!
  const error = fs.existsSync(new URL('error.txt', testUrl))
    ? fs.readFileSync(new URL('error.txt', testUrl), 'utf8')
    : null

  test(`toRdf: ${testFolder}`, async () => {
    const executeTest = async () => {
      const output = await dataToRdf({
        shapes,
        data,
        ...settings
      })

      const serializedOutput = await write([...output], {
        ordered: true,
        /** @ts-expect-error type mismatch */
        prefixes: {
          ...prefixes,
          ...Object.fromEntries(Object.entries(settings.context).filter(([k]) => k !== '@vocab'))
        }
      })
      expect(serializedOutput?.trim()).toBe(expected?.trim())
    }

    if (error) {
      try {
        await executeTest()
      } catch (e) {
        if (e instanceof Error) {
          expect(e.message).toStrictEqual(error!)
        } else {
          throw e
        }
      }
    } else {
      await executeTest()
    }
  })
}
