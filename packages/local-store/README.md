# LocalStore

[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-local-store.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-local-store.yml)

A RDF/js Store that reads relative turtle files from disk and mutates them via a QueryEngine such as Comunica.

## How to use:

```TypeScript

import { LocalStore } from '@shapething/localstore'
import { QueryEngine } from '@comunica/query-sparql'

const store = new LocalStore({ baseUri: new URL('http://example.org/') })
const engine = new QueryEngine()
await engine.queryQuads(
    `construct { ?s ?p ?o } where {
        { graph <http://example.org/nested/lorem> { ?s ?p ?o } } union
        { graph <https://shapething.com/lorem> { ?s ?p ?o } } union
        { graph <http://example.org/ipsum> { ?s ?p ?o } }
    }`,
    {
      sources: [store]
    }
  )
```

## Base IRI

Each file is a graph named after its path, appended to the base IRI: with the base `http://example.org/`,
`nested/lorem.ttl` is the graph `<http://example.org/nested/lorem>`. The base IRI ends on a `/` or a `#`.

A folder can set its own base IRI in a `.config` file (JSON) at its root, which overrides the `baseUri`
given to the store:

```json
{
  "baseIri": "https://example.com/def/"
}
```

```TypeScript
await store.mount('example')
store.getBaseUri() // The base IRI in use: from .config, otherwise the one given to the store.
store.getConfiguredBaseUri() // The base IRI from .config, undefined when the folder sets none.
await store.saveBaseUri(new URL('https://example.com/def/')) // Writes it to .config.
await store.loadConfig() // Reads .config again, for example once permission to read the folder is given.
```

It is best to execute queries with graphs selected.
This gives the best performance.
