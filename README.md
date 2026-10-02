# Monorepo of ShapeThing

[![Lint](https://github.com/ShapeThing/shapething/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/ShapeThing/shapething/actions/workflows/lint.yml)

ShapeThing is a collection of tools to make developing applications based on RDF easier. These tools are all using TypeScript and use the RDF/js ecosystem.

Tools in order of size / functionality

## SHACL renderer

[![Unit tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-shacl-renderer-unit.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-shacl-renderer.yml) [![Storybook tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-shacl-renderer-storybook.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-shacl-renderer.yml)

A toolkit to render SHACL. It can render forms, displays and facets. There are also tools to generate TypeScript types, generate RDF data and transfrom from RDF to JavaScript and vice versa.

## Resource fetcher

[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-resource-fetcher.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-resource-fetcher.yml)

Fetches resources via CBD (concise bounded description) and SHACL shapes from SPARQL endpoints or in-memory stores.

## SHACL manager

[![Unit tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-shacl-manager-unit.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-shacl-manager.yml) [![Storybook tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-shacl-manager-storybook.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-shacl-manager.yml)

A tool yet to be developed to create and manage SHACL shapes.

## Typed SPARQL

[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-typed-sparql.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-typed-sparql.yml)

A Vite plugin to have strong types for SPARQL select queries.

## Local store

[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-local-store.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-local-store.yml)

A Chrome only RDF/js store that allows SPARQL on a folder on disk. Files are relative to the base IRI or they contain the named graph as a hash.

## Text store

[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-text-store.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-text-store.yml)

A wrapper for an RDF/js store that enables TRIE searches on the literals in the store.