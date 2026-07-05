---
title: Getting started
order: 1
---

## Creating a project

Use [Vite](https://vite.dev/guide/) to set up React TypeScript project.
The main command is:

`npm create vite@latest shacl-example -- --template react-ts`


## Installing

Run the following command in your terminal in the root of your project:

`npm install @shapething/shacl-renderer`

## Rendering your first form

For your first form it is helpful to start with a simple SHACL shape.

Here is an example:

```turtle
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix schema: <https://schema.org/> .

<>
  a sh:NodeShape ;
  sh:targetClass schema:Person ;

  sh:property [
    sh:name "Given name"@en, "Gegeven naam"@nl ;
    sh:path schema:givenName ;
    sh:minCount 1;
    sh:maxCount 1;
    sh:datatype xsd:string ;
  ];
.

```

Save this file as `contact.ttl` in the public folder of your project, inside a folder called 'shapes'.
Now add the following React code in App.tsx.

```typescript
import { ShaclRenderer } from '@shapething/shacl-renderer'

export function MyForm() {
  return <ShaclRenderer mode="edit" shapes={new URL('/shapes/contact.ttl', location.origin)} />
}
```