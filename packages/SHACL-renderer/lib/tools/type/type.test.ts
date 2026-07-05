import fs from 'fs'
import { format } from 'prettier'
import * as parserTypeScript from 'prettier/parser-typescript'
import { expect, test } from 'vitest'
import { commonPrettierOptions, toType } from './type'

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
  const output = fs.existsSync(new URL('output.ts', testUrl))
    ? fs.readFileSync(new URL('output.ts', testUrl), 'utf8')
    : null
  const error = fs.existsSync(new URL('error.txt', testUrl))
    ? fs.readFileSync(new URL('error.txt', testUrl), 'utf8')
    : null

  test(`toType: ${testFolder}`, async () => {
    const executeTest = async () => {
      const typeOutput = await toType({
        shapes,
        ...settings
      })

      const formattedGeneratedCode = await format(typeOutput?.type || '', {
        parser: 'typescript',
        plugins: [parserTypeScript],
        ...commonPrettierOptions
      })

      const formattedExpectedCode = await format(output?.trim() || '', {
        parser: 'typescript',
        plugins: [parserTypeScript],
        ...commonPrettierOptions
      })

      expect(formattedGeneratedCode).toStrictEqual(formattedExpectedCode)
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
