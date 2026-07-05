# LocalStore

A RDF/js Store that reads relative turtle files from disk and mutates them via a QueryEngine such as Comunica.

## How to use:

```TypeScript

import { LocalStore } from '@shapething/localstore'
import { QueryEngine } from '@comunica/query-sparql'

const store = new LocalStore({ baseUri: new URL('http://example.com/') })
const engine = new QueryEngine()
await engine.queryQuads(
    `construct { ?s ?p ?o } where {
        { graph <http://example.com/nested/lorem> { ?s ?p ?o } } union
        { graph <https://shapething.com/lorem> { ?s ?p ?o } } union
        { graph <http://example.com/ipsum> { ?s ?p ?o } }
    }`,
    {
      sources: [store]
    }
  )
```

It is best to execute queries with graphs selected.
This gives the best performance.
