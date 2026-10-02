# Text Store

[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-text-store.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-text-store.yml)

A thin wrapper around [N3 Store](https://github.com/rdfjs/N3.js) and [Flexsearch](https://github.com/nextapps-de/flexsearch) enabling in-memory fuzzy text search.

```TypeScript
import { TextStore } from '@shapething/textstore'
import { DataFactory } from 'n3'
const { namedNode, literal, quad } = DataFactory

const store = new TextStore()
store.add(quad(namedNode('a'), namedNode('https://schema.org/name'), literal('John Doe')))
const result = store.match(null, namedNode('https://textstore.shapething.com/search'), literal('Jo'))
// Result contains John Doe
```

# Install

```sh
npm install @shapething/textstore
```
