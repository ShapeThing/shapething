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
  display shapes in `src/shapes/` (one `.ttl` file per shape, put together in `src/shapes/shapes.ts`):
  - `inf:ColumnShape`: a person in a column, with their works, interests and ideas once opened,
  - `inf:TeaserShape`: a search result,
  - `inf:PersonModalShape`, `inf:WorkModalShape`, `inf:ConceptModalShape`: everything about a person,
    work, interest or idea in the modal, with `inf:AllPropertiesShape` for every other property.
  - `inf:PersonWorksShape`, `inf:PersonIdeasShape`, `inf:PersonInterestsShape`: the tabs of a person
    in the modal, their works on a timeline between their birth and death, their ideas and interests
    as cards (`src/shapes/PersonListShapes.ttl`).

The app's own viewers, registered in `src/widgets/index.ts`:

- `inf:RelativeInfluenceViewer`: the number of people someone influenced, as a bar relative to the
  people shown at the moment (`src/influence/influenceScale.ts`).
- `inf:YearViewer`: the year of a Wikidata date, with BCE for the years before the common era.
- `inf:PortraitViewer`: a portrait, or the person's initials when Wikidata has none.
- `inf:EntityLinkViewer`: a name that opens its entity in the modal.
- `shui:ImageViewer` is replaced by one that opens the image in a lightbox (PhotoSwipe).

## The URL

The URL is the state of the app (`src/routing.ts`):

- the path is the chain of opened people: `/Q859,Q868`. The sort order of a column stands beside the
  person it belongs to, as on the screen: `b` (born earliest) or `n` (name) after an identifier
  sorts the people they influenced, before the first one their influencers: `/n:Q859:b,Q868`
  (`src/sorting.ts`).
  Without a code a column is sorted by influence, so older URLs still work,
- the hash is the modal: `#Q868` for an entity (`#Q868/works`, `#Q868/ideas` or `#Q868/interests`
  for a tab of a person), `#info` for the explanation of the app and
  `#timeline` for the lifespans of the people in the chain.

## Development

```sh
vp install
vpr --filter @shapething/influence dev    # http://localhost:8005
vpr --filter @shapething/influence build  # to dist/
vpr --filter @shapething/influence test   # the unit tests (*.test.ts)
```

Every path of the app (`/Q859,Q868`) serves `index.html`, so the host needs a fallback to it.
