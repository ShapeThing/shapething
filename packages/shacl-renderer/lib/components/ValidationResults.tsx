import { useContext } from 'react'
import { ValidationResult } from '../ValidationReport'
import { mainContext } from '../core/main-context'

export default function ValidationResults({ results }: { results: ValidationResult[] }) {
  if (!results || results.length === 0) return null
  const { jsonLdContext } = useContext(mainContext)

  return (
    <>
      {results.map((result, index) => {
        let message = result.message.map(message => message.value).join('\n')

        for (const value of Object.values(result.args)) {
          if (
            value &&
            typeof value === 'object' &&
            'termType' in value &&
            value.termType === 'NamedNode' &&
            'value' in value &&
            typeof value.value === 'string'
          ) {
            const compactedIri = jsonLdContext.compactIri(value.value)
            message = message.replace(`<${value.value}>`, compactedIri)
          }
        }

        return (
          <div
            key={index}
            className={`validation-result ${result.severity.value.split(/\/|#/g).pop()?.toLocaleLowerCase()}`}
          >
            {message}
          </div>
        )
      })}
    </>
  )
}
