/* eslint-disable @typescript-eslint/no-explicit-any */
import { NamedNode, Term } from '@rdfjs/types'
import { JsonLdContextNormalized } from 'jsonld-context-parser/lib/JsonLdContextNormalized'

export const getErrorMessages = (errors: any[], term: Term, jsonLdContext: JsonLdContextNormalized) => {
  const itemErrors = errors?.filter((error: any) => error.value?.term.equals(term)) ?? []

  const messages = itemErrors.flatMap(error => {
    return error.message
      .map((message: any) => [error.severity, message.value])
      .map(([severity, message]: [NamedNode, string]) => {
        for (const iri of Object.values(error.args ?? {})) {
          if (!iri || !(iri as NamedNode)?.value) {
            continue
          }
          const compactedIRI = jsonLdContext.compactIri((iri as NamedNode).value, true)
          message = message.replaceAll(
            `<${(iri as NamedNode).value}>`,
            `<strong class="iri" title="${(iri as NamedNode).value}">${compactedIRI}</strong>`
          )
        }
        return [severity, message]
      })
  })

  return messages
}
