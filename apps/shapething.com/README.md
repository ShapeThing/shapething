# shapething.com

The ShapeThing website, built with [Astro](https://astro.build). The ontology documentation is generated from `src/rdf/ontology.ttl` by a content loader (`src/shapethingLoader.ts`) that uses `@shapething/shacl-renderer` from this workspace.

## Commands

Run from the monorepo root:

| Command                                      | Action                                    |
| :------------------------------------------- | :---------------------------------------- |
| `pnpm --filter @shapething/website dev`      | Starts the dev server at `localhost:8000` |
| `pnpm --filter @shapething/website build`    | Builds the site to `./dist/`              |
| `pnpm --filter @shapething/website preview`  | Previews the build                        |
