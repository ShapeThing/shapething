import factory from 'npm:@rdfjs/data-model'
import { Parser, Store, Writer } from 'npm:n3'
import { prefixes, rdf } from '../lib/core/namespaces.ts'
import { getUsages } from './helpers/getUsages.ts'

/**
 * This script updates ontology.ttl with the actual usages of all custom namespaces found in namespaces.ts
 */

const getUsedPredicates = () => {
  const projectRoot = Deno.cwd()

  const wellKnownNamespaces = [
    'https://schema.org/',
    'https://schemas.link/shacl-next#',
    'http://www.w3.org/ns/shacl#',
    'http://www.w3.org/2002/07/owl#',
    'http://www.w3.org/2001/XMLSchema#',
    'http://www.w3.org/2004/02/skos/core#',
    'http://www.w3.org/2000/01/rdf-schema#',
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'http://example.com/',
    'http://datashapes.org/dash#'
  ]

  const namespaces = getUsages(['namespace'], projectRoot, ['namespaces.ts']).filter(namespaceMatch => {
    const namespace = namespaceMatch.firstStringArgument
    if (namespace && !wellKnownNamespaces.includes(namespace)) return true
  })

  const foundSuffixes = getUsages(
    namespaces.map(namespace => namespace.methodIdentifier!),
    projectRoot
  )

  return foundSuffixes.map(foundSuffix => {
    const namespace = namespaces.find(namespace => foundSuffix.targetMethodName === namespace.methodIdentifier)!
    return [namespace.firstStringArgument, foundSuffix.firstStringArgument] as [string, string]
  })
}

const predicates = getUsedPredicates()

const isUpperCase = (str: string) => str[0] === str[0].toUpperCase()
const parser = new Parser()
const ontologyFile = Deno.readTextFileSync('ontology/ontology.ttl')
const store = new Store(parser.parse(ontologyFile))

for (const [prefix, suffix] of predicates) {
  store.add(
    factory.quad(
      factory.namedNode(`${prefix}${suffix}`),
      rdf('type'),
      isUpperCase(suffix) ? rdf('Class') : rdf('Property')
    )
  )
}

const writer = new Writer({ prefixes })
const sortedQuads = [...store].sort((a, b) => a.subject.value.localeCompare(b.subject.value))
for (const quad of sortedQuads) {
  writer.addQuad(quad)
}
writer.end((_error: Error, result: string) => {
  Deno.writeTextFileSync('ontology/ontology.ttl', result)
})
