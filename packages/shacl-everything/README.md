# @shapething/shacl-everything

A SHACL toolkit for React. Give it a SHACL shapes graph and an RDF data graph and it renders a
user interface for them:

- **edit** – a form for creating or updating a resource,
- **view** – a read-only presentation of a resource,
- **facet** – faceted search/filtering over the instances in a graph.

Validation runs live as you edit. The package implements the
[SHACL 1.2 Core](https://www.w3.org/TR/shacl12-core/) specification and the proposed SHACL-UI
(`shui:`, `http://www.w3.org/ns/shacl-ui/`) extension: widget selection through declarative
scoring, value-node labels via property roles, language resolution, and federated search.

Part of [ShapeThing](https://shapething.com).

## Install

```sh
npm install @shapething/shacl-everything react react-dom
```

`react` and `react-dom` (^19) are peer dependencies.

## Usage

```tsx
import { ShaclRenderer, type SubmitResult } from "@shapething/shacl-everything";
import "@shapething/shacl-everything/style.css";
import { DataFactory } from "rdf-data-factory";

const factory = new DataFactory();

export function PersonForm() {
  return (
    <ShaclRenderer
      // Either graph can be a URL, a string of RDF (Turtle, JSON-LD, ...), an RdfStore or quads.
      shapesGraph={new URL("https://example.org/shapes.ttl")}
      dataGraph={new URL("https://example.org/people/alice.ttl")}
      focusNode={factory.namedNode("https://example.org/people/alice")}
      nodeShapes={[factory.namedNode("https://example.org/shapes#PersonShape")]}
      mode="edit" // "edit" | "view" | "facet"
      onSubmit={(result: SubmitResult) => {
        // result.dataGraph is a snapshot of the edited data;
        // result.additions / result.deletions are the quads that changed.
        console.log(result.additions, result.deletions);
      }}
    />
  );
}
```

`ShaclRenderer` accepts any subset of the `Environment` fields. Fields you leave out fall back to
their defaults. When `nodeShapes` is omitted, it is resolved from the shapes that target the
`focusNode`. The package also exports the types you need to configure it, write a custom widget,
or write your own preprocessor: `Environment`, `RawEnvironment`, `SubmitResult`, `Preprocessor`,
`WidgetProps`, `WidgetComponent`, `WidgetMeta`, `Widgets`, `PropertyUIElement`, and the values
`defaultPreprocessors`, `defaultWidgets`, `defaultEnvironment` and `minimalEnvironment`.

### Stylesheet

The components render into the light DOM and ship their styles as one stylesheet. Import it
once, wherever your application loads global CSS:

```ts
import "@shapething/shacl-everything/style.css";
```

### Web component

For pages that don't use React themselves, a `<shacl-renderer>` custom element is also
available. You still need to load the stylesheet and install `react`/`react-dom`, because the
element uses them internally.

```html
<link rel="stylesheet" href="/node_modules/@shapething/shacl-everything/dist/style.css" />
<script type="module">
  import "@shapething/shacl-everything/webcomponent";
</script>

<shacl-renderer
  shapes="/shapes.ttl"
  data="/alice.ttl"
  focus-node="https://example.org/people/alice"
  node-shapes="https://example.org/shapes#PersonShape"
  mode="edit"
></shacl-renderer>
```

Attributes cover the string and boolean settings. Anything else (pre-parsed stores, custom
widgets, preprocessors, locale loaders) goes through the element's `environment` JavaScript
property. Submitting dispatches a `shacl-submit` `CustomEvent` whose `detail` is the
`SubmitResult`.

### Tools

The `./tools` entry point holds SHACL-driven code generation and conversion utilities. They live
in a separate entry so the renderer bundle doesn't pull in their dependencies:

```ts
import { generate, jsToRdf, rdfToJs, shaclToType } from "@shapething/shacl-everything/tools";
```

- `generate`: generates fake data that conforms to a shape (uses `@faker-js/faker`).
- `jsToRdf` / `rdfToJs`: convert between plain JavaScript objects and RDF, guided by a shape.
- `shaclToType`: generates TypeScript type declarations from node shapes.

## Funding

This project is funded through [NGI0 Commons Fund](https://nlnet.nl/commonsfund), a fund
established by [NLnet](https://nlnet.nl) with financial support from the European Commission's
[Next Generation Internet](https://ngi.eu) program. Learn more at the
[NLnet project page](https://nlnet.nl/project/ShapeThing).

[<img src="https://nlnet.nl/logo/banner.png" alt="NLnet foundation logo" width="20%" />](https://nlnet.nl)
[<img src="https://nlnet.nl/image/logos/NGI0_tag.svg" alt="NGI Zero Logo" width="20%" />](https://nlnet.nl/commonsfund)

## License

[GPL-3.0-only](./LICENSE)
