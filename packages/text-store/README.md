# Text Store

[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-text-store.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-text-store.yml)

Wraps any [RDF/JS](https://rdf.js.org/stream-spec/) store, such as an [N3 Store](https://github.com/rdfjs/N3.js) or a [LocalStore](../local-store), and adds in-memory fuzzy text search with [Flexsearch](https://github.com/nextapps-de/flexsearch).

```TypeScript
import { TextStore } from '@shapething/textstore'
import { DataFactory, Store } from 'n3'
const { namedNode, literal, quad } = DataFactory

const store = new TextStore({ store: new Store() })
store.add(quad(namedNode('a'), namedNode('https://schema.org/name'), literal('John Doe')))
const result = store.match(null, namedNode('https://textstore.shapething.com/search'), literal('Jo'))
// The stream contains the quad with John Doe
```

Or in SPARQL, for example with Comunica:

```sparql
SELECT ?s ?label WHERE {
  ?s <https://textstore.shapething.com/search> "Jo" .
  ?s <https://schema.org/name> ?label .
}
```

- Patterns without the search predicate are passed through to the wrapped store.
- The text index is built from all literals of the wrapped store on the first search.
- `add()` and `delete()` are forwarded to the wrapped store when it supports them and keep the index up to date.
- When the wrapped store is changed directly, call `await store.reindex()`.
- Use `indexOptions` to configure Flexsearch, for example a typo tolerant encoder.

# Install

```sh
npm install @shapething/textstore
```
