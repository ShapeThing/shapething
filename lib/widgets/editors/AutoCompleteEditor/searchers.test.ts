import { describe, expect, test } from 'vitest'
import { getShapes } from '../../../core/main-context'
import { sh } from '../../../core/namespaces'
import { getPurposePredicates } from '../../../helpers/getPurposePredicates'
import { propertyToSearchQuery } from './searchers'
const baseUrl = `file://${process.cwd()}/lib/widgets/editors/AutoCompleteEditor/`

describe('propertyToSearchQuery', () => {
  test('with sh:node and sh:class', async () => {
    const shapeUrl = new URL(`autocomplete.test.ttl#example1`, baseUrl)

    const { shapePointer } = await getShapes({ shapesInput: shapeUrl })

    const query = propertyToSearchQuery({
      property: shapePointer.out(sh('property')),
      search: '',
      labelPredicates: getPurposePredicates('label'),
      imagePredicates: []
    })

    expect(query.includes('<https://schema.org/Person>')).toBeTruthy()
  })

  test('with sh:node without sh:class', async () => {
    const shapeUrl = new URL(`autocomplete.test.ttl#example2`, baseUrl)

    const { shapePointer } = await getShapes({ shapesInput: shapeUrl })

    const query = propertyToSearchQuery({
      property: shapePointer.out(sh('property')),
      search: '',
      labelPredicates: getPurposePredicates('label'),
      imagePredicates: []
    })

    expect(query.includes('<https://schema.org/Person>')).toBeFalsy()
  })
})
