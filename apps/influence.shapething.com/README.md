# Influence

A web app to explore who influenced whom, with data from Wikidata (P737, influenced by) and the
introductions of Wikipedia articles. Start with a person, open the people they influenced, and follow
the chain.

Built on the ShapeThing packages:

- [typed-sparql](../../packages/typed-sparql): every query is an `.rq` file in `src/queries`, and the
  Vite plugin generates the type of its rows next to it (`.rq.d.ts`). `src/sparql/select.ts` runs them on
  the Wikidata query service; `$name` variables are filled in by `src/sparql/parameterize.ts`.
- [shacl-renderer](../../packages/shacl-renderer): the query results become a small RDF data graph
  (`src/data/graphs.ts`, with Wikidata's own predicates) that is rendered in view mode with one of the
  display shapes in `src/shapes/shapes.ttl`:
  - `inf:ColumnShape`: a person in a column, with their works, interests and ideas once opened,
  - `inf:TeaserShape`: a search result,
  - `inf:ModalShape`: everything about a person, work, interest or idea in the modal.

Two custom viewers, registered in `src/widgets/index.ts`:

- `inf:RelativeInfluenceViewer`: the number of people someone influenced, as a bar relative to the
  people shown at the moment (`src/influence/influenceScale.ts`).
- `inf:YearViewer`: the year of a Wikidata date, with BCE for the years before the common era.

## Development

```sh
vp install
vpr --filter @shapething/influence dev    # http://localhost:8005
vpr --filter @shapething/influence build  # to dist/
```

Every path of the app (`/Q859,Q868`) serves `index.html`, so the host needs a fallback to it.
