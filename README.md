# Monorepo of ShapeThing

ShapeThing is a collection of tools to make developing applications based on RDF easier. These tools are all using TypeScript and use the RDF/js ecosystem.

Tools in order of size / functionality

## SHACL renderer

A toolkit to render SHACL. It can render forms, displays and facets. There are also tools to generate TypeScript types, generate RDF data and transfrom from RDF to JavaScript and vice versa.

## Resource fetcher

Fetches resources via CBD (concise bounded description) and SHACL shapes from SPARQL endpoints or in-memory stores.

## SHACL manager

A tool yet to be developed to create and manage SHACL shapes.

## Typed SPARQL

A Vite plugin to have strong types for SPARQL select queries.

## Local store

A Chrome only RDF/js store that allows SPARQL on a folder on disk. Files are relative to the base IRI or they contain the named graph as a hash.

## Text store

A wrapper for an RDF/js store that enables TRIE searches on the literals in the store.