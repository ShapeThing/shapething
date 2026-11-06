# @shapething/resource-fetcher

## 3.1.0

### Minor Changes

- **Features**
  
  - New `shapesGraph` (an RDF/JS `DatasetCore`) and `shapeIris` constructor options. They remove the need to build a grapoi `shapesPointer` yourself and must be passed together. `shapesPointer` still works and wins if given.
  - New `useNamedGraphs: false` option for triple-only endpoints such as Wikidata or Blazegraph. No `GRAPH` clause and no graph detection.
  - New `overfetch: "all" | "blankNodes"` option. `"blankNodes"` limits the look-ahead pattern to blank-node values, which keeps queries small on large knowledge graphs.
  - `sh:memberShape` that points to node shapes via `sh:node` is now followed.
  
  **Fixes**
  
  - Graph auto-detection now runs when no `graph` is given; the condition was inverted. Queries are now scoped to the resource's graph whenever it lives in exactly one named graph.
  - Nested `sh:node` fetches only reuse a graph the caller passed explicitly, not one that was detected.
  - `execute()` results are de-duplicated; RDF lists produced repeated quads.
  - RDF list order is kept when list items are numeric-looking literals.
