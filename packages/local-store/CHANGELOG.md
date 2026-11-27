# @shapething/localstore

## 0.3.0

### Minor Changes

- aad98fc: A folder can set its own base IRI in a `.config` file (JSON, `{ "baseIri": "…" }`) at its root, which overrides the base IRI given to the store. Adds `getBaseUri()`, `getConfiguredBaseUri()`, `saveBaseUri()` to write it to `.config`, and `loadConfig()` to read it again once permission to the folder is given.
- 1df835a: Adds `getDirectoryHandle()` and `LocalStore.listMounts()`, skips `.git` and `node_modules` when listing the graphs of a folder, and writes pretty-printed Turtle (grouped subjects, nested blank nodes, lists) with `@jeswr/pretty-turtle`.
- c2deed6: Files are written with IRIs relative to their graph where they can be (`<>` for the graph itself, `<#name>`, `<other>`, `<../other>`), now also under the default `file:` base IRI, which the Turtle writer did not relativize. A file keeps its meaning when the folder gets another base IRI. IRIs of `.ttl` files stay absolute, as a relative one is read as that file's graph.
- aad98fc: Adds `LocalStore.removeMount(name)`, which forgets a folder that was connected before (and its stored handle) without needing it mounted. `unmount()` now also removes the stored handle.

## 0.2.0

### Minor Changes

- **Breaking**

  - License changed from MIT to GPL-3.0-only.
  - Turtle files are now written with `@prefix` declarations, limited to the prefixes the quads actually use (taken from the existing file, every file the store has read, and any you pass in). Files on disk will show diffs.
  - Runtime dependency `n3` moved from ^1.25 to ^2.7; `idb-keyval` ^6.3 added.

  **Features**

  - New `replaceGraph(graph, quads, prefixes?)` overwrites a whole graph file, for example one with blank nodes, which can't be matched for deletion.
  - `updateGraph()` accepts an optional `prefixes` field.
  - New `matchDistinctTerms()`, `countDistinctTerms()` and `features.indexDistinctTerms` let Comunica answer `SELECT DISTINCT` on one pattern. Listing graphs works from file names without parsing any file.
  - The folder listing is cached after one walk and pre-warmed on `mount()`. The cache is cleared when the store adds or removes a file, and on `setBaseUri()` and `unmount()`.

  **Fixes**

  - `default-graph.ttl` is now recognised as the default graph.
  - Files from N3 1.x that contain a literal typed `rdf:langString` with no language tag are repaired when read, and such literals are no longer written.
  - `mount()` asks the directory picker for `readwrite` mode.
