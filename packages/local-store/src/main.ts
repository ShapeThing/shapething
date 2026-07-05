import { QueryEngine } from '@comunica/query-sparql'
import type { Term } from '@rdfjs/types'
import { Parser } from 'n3'
import { LocalStore } from '../lib/LocalStore'

const termToString = (term: Term) => {
  if (term.termType === 'BlankNode') return `_:${term.value}`
  if (term.termType === 'NamedNode') return `<${term.value}>`
  if (term.termType === 'Literal' && term.language) return `"${term.value}"@${term.language}`
}

const store = new LocalStore({
  baseUri: new URL('http://example.com/')
})

const engine = new QueryEngine()

document.querySelector('#mount-store')?.addEventListener('click', async () => {
  console.log('Store mount')
  await store.mount('example')
})

document.querySelector('#graphs')?.addEventListener('click', async () => {
  for await (const graph of store.getNamedGraphs()) {
    console.log(graph)
  }
})

document.querySelector('#query')?.addEventListener('click', async () => {
  const quadsStream = await engine.queryQuads(
    `construct { ?s ?p ?o } where { 
        { graph <http://example.com/nested/lorem> { ?s ?p ?o } } union
        { graph <https://shapething.com/lorem> { ?s ?p ?o } } union
        { graph <http://example.com/ipsum> { ?s ?p ?o } }
    }`,
    {
      sources: [store]
    }
  )

  const quads = await quadsStream.toArray()
  console.log(quads)
})

document.querySelector('#update')?.addEventListener('click', async () => {
  const contents = (document.querySelector('#input-area') as HTMLTextAreaElement)?.value
  const quads = new Parser({
    baseIRI: new URL('http://example.com/').toString()
  }).parse(contents)

  const query = `insert data { ${quads.map(
    quad =>
      `GRAPH ${termToString(quad.graph)} { ${termToString(quad.subject)} ${termToString(quad.predicate)} ${termToString(
        quad.object
      )} . }`
  )} }`

  await engine.queryVoid(query, {
    sources: [store]
  })
})

document.querySelector('#delete')?.addEventListener('click', async () => {
  const query = `drop graph <http://example.com/lorem>`

  await engine.queryVoid(query, {
    sources: [store]
  })
})

document.querySelector('#delete-where')?.addEventListener('click', async () => {
  const query = `DELETE WHERE { 
    GRAPH <http://example.com/y/> {
      <http://example.com/y/> <http://example.com/y/lorem> <http://example.com/y/ipsum>
    }
  }
`

  await engine.queryVoid(query, {
    sources: [store]
  })
})

document.querySelector('#query-2')?.addEventListener('click', async () => {
  const bindingStream = await engine.queryBindings(`select distinct ?g { graph ?g { ?s ?p ?o } }`, {
    sources: [store]
  })

  const bindings = await bindingStream.toArray()
  console.log(bindings.length)
  for (const binding of bindings) {
    console.log(binding.get('g'))
  }
  console.log(store.prefixes)
})
