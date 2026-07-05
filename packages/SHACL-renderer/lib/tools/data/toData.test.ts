import fs from 'fs'
import { expect, test } from 'vitest'
import { rdfToData } from './rdfToData'

const baseUrl = new URL('./test-support/to-data/', import.meta.url)
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
  const data = fs.existsSync(new URL('data.ttl', testUrl))
    ? fs.readFileSync(new URL('data.ttl', testUrl), 'utf8')
    : null!
  const expected = (await import(new URL('output.ts', testUrl).toString())).default
  const error = fs.existsSync(new URL('error.txt', testUrl))
    ? fs.readFileSync(new URL('error.txt', testUrl), 'utf8')
    : null

  test(`toData: ${testFolder}`, async () => {
    const executeTest = async () => {
      const output = await rdfToData({
        shapes,
        data,
        ...settings
      })
      expect(output).toStrictEqual(expected)
    }

    if (error) {
      try {
        await executeTest()
      } catch (e) {
        expect((e as Error).message).toStrictEqual(error!)
      }
    } else {
      await executeTest()
    }
  })
}
