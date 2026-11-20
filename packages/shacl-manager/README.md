# @shapething/shacl-manager

[![Unit tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-shacl-manager-unit.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-shacl-manager.yml)

A React component for managing a data model: the SHACL shapes and the OWL/RDFS ontology it
consists of. You give it the IRI of the data model and a way to load graphs. It follows the
model's `owl:imports`, and lets you browse everything and edit the model's own graph.

A data model is a graph typed `owl:Ontology` or `sh:ShapesGraph`. Older models use
`owl:Ontology` for shapes graphs too; both are supported.

Part of [ShapeThing](https://shapething.com). Everything is shown and edited through the
[SHACL renderer](../shacl-renderer).

## Install

```sh
npm install @shapething/shacl-manager react react-dom
```

## Usage

```tsx
import type { NamedNode } from "@rdfjs/types";
import { dereferenceUrl } from "@shapething/shacl-renderer";
import { ShaclManager, type Changes, type LoadGraph } from "@shapething/shacl-manager";
import { DataFactory } from "rdf-data-factory";

const factory = new DataFactory();

// Every quad comes back in the graph that was asked for, with the prefixes the document declared.
const loadGraph: LoadGraph = async (graph: NamedNode) => {
  const prefixes = new Map<string, string>();
  const store = await dereferenceUrl(new URL(graph.value), new Map(), undefined, prefixes);
  return {
    quads: store
      .getQuads()
      .map((quad) => factory.quad(quad.subject, quad.predicate, quad.object, graph)),
    prefixes: Object.fromEntries(prefixes),
  };
};

export function App() {
  return (
    <ShaclManager
      dataModelIRI={factory.namedNode("https://example.org/model#")}
      loadGraph={loadGraph}
      // Resolving marks the changes as saved; rejecting keeps them pending.
      onSubmit={(changes: Changes) => save(changes.additions, changes.deletions)}
    />
  );
}
```

The manager imports the renderer's stylesheet itself.

### Props

| Prop           | Type                                             | Description                                                                                                                                                                                           |
| -------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataModelIRI` | `NamedNode`                                      | The data model's graph. This is the graph that gets edited.                                                                                                                                           |
| `loadGraph`    | `LoadGraph`                                      | Loads a graph by IRI: `(graph) => Promise<{ quads, prefixes }>`. Each quad must have `graph` as its graph. Used for the model and its imports.                                                        |
| `onSubmit`     | `(changes: Changes) => void \| Promise<unknown>` | Shows a save button with the number of pending changes, and is called with them when it is pressed. Return a promise to have the changes marked saved when it resolves; otherwise call `markSaved()`. |
| `ref`          | `Ref<ShaclManagerHandle>`                        | For a host that asks for the changes itself. See below.                                                                                                                                               |
| `languages`    | `BCP47[]`                                        | The interface languages, most preferred first. Defaults to the browser's.                                                                                                                             |
| `fallback`     | `ReactNode`                                      | Shown while the model loads.                                                                                                                                                                          |

### Changes

Edits change the manager's copy of the data model; nothing is written anywhere until the host
saves them. The changes are the additions and deletions in the data model's own graph since it
was loaded or last saved, as `{ additions: Quad[]; deletions: Quad[] }`, every quad in the graph
`dataModelIRI`. They stay pending until the host confirms they were saved, so a failed save
loses nothing.

There are two ways to get them. With `onSubmit`, the manager shows a save button. Without it, or
alongside it, a ref gives the host its own control:

```tsx
const manager = useRef<ShaclManagerHandle>(null);

<ShaclManager ref={manager} dataModelIRI={iri} loadGraph={loadGraph} />;

async function save() {
  const { additions, deletions } = manager.current!.getChanges();
  await store.update(additions, deletions);
  manager.current!.markSaved();
}
```

### Imports and the cache

Imported graphs are usually published standards, which are large and rarely change. The manager
keeps them in IndexedDB, so a reload doesn't fetch them again. An import that fails is remembered
for a day. The data model's own graph is always loaded fresh. Call `clearImportCache()` to fetch
every import again, for example after a standard published a new version.

## How it is organised

The manager has two perspectives, each split into two origins:

|          | Shapes (SHACL)                                  | Knowledge (OWL, RDFS)                                           |
| -------- | ----------------------------------------------- | --------------------------------------------------------------- |
| Managed  | Shapes in the model's own graph. Can be edited. | Classes and properties in the model's own graph. Can be edited. |
| Imported | Shapes from `owl:imports`. Read-only.           | Classes and properties from `owl:imports`. Read-only.           |

Each origin opens on a page that explains it. A shape, class or property group has its own page.
It has tabs for what is said about it (Meta), its property shapes, its SPARQL constraints and its
SHACL rules.

The view is kept in the URL hash, so a page can be linked to and survives a reload, for example
`#/shapes/managed/shape/ex:PersonShape/properties`. An IRI appears as a prefixed name when one of
the model's prefixes fits. A blank node appears as `_:` followed by a hash of its content, because
its label changes on every load.

## Contributing

```
src/
  index.tsx        The ShaclManager component
  app/             The shell: layout, sidebar, breadcrumb, routing, the meta view, editing
  data-model/      Loading, the import cache, URL segments, edits, the query cache
  shacl/           The Shapes perspective: routes, list tabs, queries/ and shapes/
  owl/             The Knowledge perspective: routes, the property index, queries/ and shapes/
  examples/        Example data models used by the stories
```

Some conventions:

- **Queries are `.rq` files.** `import query from "./x.rq"` gives the query string, typed by a
  generated `.rq.d.ts`, and `select()` from the renderer runs it. The queries share input
  variables, bound by the caller:
  - `?dataModel` is the model's graph IRI.
  - `?origin` is `"managed"` (declared in that graph) or `"imported"` (declared in any other).
  - `?subject` and `?kind` say which page the query is for: a `"shape"`, `"class"` or `"group"`.
- **Results are cached per store** (`data-model/storeCache.ts`), and components suspend on them
  with `use()`. An edit creates a new store, so nothing goes stale.
- **The renderer does the rendering.** A node's page is the renderer showing the node through a
  meta shape in `shapes/`. Editing uses the same shape, plus a layout in `*.edit.ttl`. To change
  what a page shows, change its shape, not the code.

```sh
pnpm --filter @shapething/shacl-manager test        # unit tests
pnpm --filter @shapething/shacl-manager storybook   # the example models in a browser
pnpm lint                                           # from the repository root
```

## License

GPL-3.0-only
