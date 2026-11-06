# @shapething/localstore

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
