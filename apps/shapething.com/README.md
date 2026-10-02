# shapething.com

The ShapeThing website, built with [Astro](https://astro.build). It is also the home of the ShapeThing ontology, namespace `http://shapething.com/`. The ontology is built by `buildOntology()` from `@shapething/shacl-renderer/tools`, which combines `packages/shacl-renderer/src/ontology/ontology.ttl` with the package's `st:` widgets. The integration in `astro.config.mjs` writes it to `public/index.ttl`. The `/documentation/ontology` page is generated from that file by the Astro content loader from `@shapething/shacl-renderer/astro`, which also writes the zod schema in `src/term.ts`.

On Cloudflare Pages, `functions/_middleware.ts` handles content negotiation. A request for the namespace IRI or any term IRI (for example `/GeoEditor`) that prefers `text/turtle` gets `index.ttl`. A browser asking for a term is redirected (303) to that term on the documentation page.

## Commands

Run from the monorepo root:

| Command                                      | Action                                    |
| :------------------------------------------- | :---------------------------------------- |
| `pnpm --filter @shapething/website dev`      | Starts the dev server at `localhost:8000` |
| `pnpm --filter @shapething/website build`    | Builds the site to `./dist/`              |
| `pnpm --filter @shapething/website preview`  | Previews the build                        |
