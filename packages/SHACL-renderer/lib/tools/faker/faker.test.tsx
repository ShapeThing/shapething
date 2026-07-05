import { write } from '@jeswr/pretty-turtle/dist'
import fs from 'fs'
import { expect, test } from 'vitest'
import { generateFake } from './faker'

const baseUrl = new URL('./test-support/', import.meta.url)
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
  const expected = fs.existsSync(new URL('output.ttl', testUrl))
    ? fs.readFileSync(new URL('output.ttl', testUrl), 'utf8')
    : null!
  const error = fs.existsSync(new URL('error.txt', testUrl))
    ? fs.readFileSync(new URL('error.txt', testUrl), 'utf8')
    : null

  test(`toData: ${testFolder}`, async () => {
    const executeTest = async () => {
      const output = await generateFake({
        shapes,
        ...settings,
        seed: 1
      })
      const prefixes: Record<string, string> = Object.fromEntries(
        Object.entries(settings.context as Record<string, string>).filter(([k]) => k !== '@vocab')
      )
      const serializedOutput = await write([...output], {
        ordered: true,
        prefixes
      })
      expect(serializedOutput.trim()).toStrictEqual(expected.trim())
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
