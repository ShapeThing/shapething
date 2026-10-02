# Monorepo of ShapeThing

[![Lint](https://github.com/ShapeThing/shapething/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/ShapeThing/shapething/actions/workflows/lint.yml)

ShapeThing is a collection of tools to make developing applications based on RDF easier. These tools are all using TypeScript and use the RDF/js ecosystem.

Tools in order of size / functionality

## SHACL renderer

[![Tests](https://github.com/ShapeThing/shapething/actions/workflows/test-shacl-renderer.yml/badge.svg?branch=main)](https://github.com/ShapeThing/shapething/actions/workflows/test-shacl-renderer.yml)

A toolkit to render SHACL. It can render forms, displays and facets. There are also tools to generate TypeScript types, generate RDF data and transfrom from RDF to JavaScript and vice versa.

## Resource fetcher

[![Tests](https://github.com/ShapeThing/shapething/actions/workflows/test-resource-fetcher.yml/badge.svg?branch=main)](https://github.com/ShapeThing/shapething/actions/workflows/test-resource-fetcher.yml)

Fetches resources via CBD (concise bounded description) and SHACL shapes from SPARQL endpoints or in-memory stores.

## SHACL manager

[![Tests](https://github.com/ShapeThing/shapething/actions/workflows/test-shacl-manager.yml/badge.svg?branch=main)](https://github.com/ShapeThing/shapething/actions/workflows/test-shacl-manager.yml)

A tool yet to be developed to create and manage SHACL shapes.

## Typed SPARQL

[![Tests](https://github.com/ShapeThing/shapething/actions/workflows/test-typed-sparql.yml/badge.svg?branch=main)](https://github.com/ShapeThing/shapething/actions/workflows/test-typed-sparql.yml)

A Vite plugin to have strong types for SPARQL select queries.

## Local store

[![Tests](https://github.com/ShapeThing/shapething/actions/workflows/test-local-store.yml/badge.svg?branch=main)](https://github.com/ShapeThing/shapething/actions/workflows/test-local-store.yml)

A Chrome only RDF/js store that allows SPARQL on a folder on disk. Files are relative to the base IRI or they contain the named graph as a hash.

## Text store

[![Tests](https://github.com/ShapeThing/shapething/actions/workflows/test-text-store.yml/badge.svg?branch=main)](https://github.com/ShapeThing/shapething/actions/workflows/test-text-store.yml)

A wrapper for an RDF/js store that enables TRIE searches on the literals in the store.