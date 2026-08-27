# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

`@shapething/monorepo` — a pnpm workspace + Turborepo monorepo for ShapeThing (shapething.com), a set of SHACL/RDF tooling libraries and the apps that showcase them. Node version is pinned via `.nvmrc` (22); package manager is pnpm (pinned exact version in root `package.json`'s `packageManager` field — use that pnpm, not whatever is globally installed).

Workspace members: `packages/*` and `apps/*` (see `pnpm-workspace.yaml`).

## Commands (run from repo root)

- `pnpm install` — install all workspace dependencies.
- `pnpm build` / `pnpm dev` / `pnpm lint` / `pnpm test` — fan out to every workspace package via `turbo run <task>` (see `turbo.json`). `build` depends on dependency packages' own `build` first (`dependsOn: ["^build"]`) and caches `dist/**`.
- `turbo run <task> --filter=<pkg-name>` — run a task for one workspace member only (e.g. `turbo run test --filter=@shapething/shacl-everything`); or `cd` into the package and run its own script directly.
- `pnpm changeset` — add a changeset before merging a PR that should ship a version bump.
- `pnpm release` — builds every `packages/*` and runs `changeset publish` (apps are excluded from publishing; see `.changeset/config.json`'s `ignore` list).

**Linting is standardized repo-wide on `vp lint`** (oxlint, bundled via the `vite-plus` package's `vp` CLI) — every package/app's `"lint"` script is `vp lint` (packages with JSX/TSX add `--react-plugin --jsx-a11y-plugin`). Do not reintroduce ESLint; a root `.prettierrc` and old ESLint remnants exist in git history but are not the working toolchain.

**`vp` usage is not uniform across the repo**: `packages/shacl-everything` is the only package that uses `vite-plus` for everything (`vp pack`/`vp dev`/`vp test`/`vp check`, not just lint) — see its own `packages/shacl-everything/CLAUDE.md`. Every other package/app uses plain `vite`/`vitest`/`tsc` (or `astro`) for build/dev/test, and only borrows `vp` for the `lint` script.

**CI** (`.github/workflows/lint.yml`) runs `pnpm run lint` on every PR and push to `main`. There is currently no CI test job — `pnpm test` / `turbo run test` is not gated by CI, so run tests locally before considering a change done. `.github/workflows/publish.yml` runs the changesets release flow on push to `main`; `chromatic.yml` (Storybook visual regression) is manual-dispatch only.

## Packages

- **`packages/shacl-everything`** (`@shapething/shacl-everything`) — a React SHACL form/validation toolkit that reads shapes+data RDF graphs and renders editable/viewable/faceted UI, implementing the SHACL 1.2 Core spec plus a proposed `shui:` (SHACL-UI) extension end-to-end. This is the actively-developed core library; **see `packages/shacl-everything/CLAUDE.md` for its architecture** — it's substantial enough to warrant its own file.
- **`packages/shacl-renderer`** (`@shapething/shacl-renderer`) — the earlier/parallel SHACL-driven RDF renderer, published both as React components and as a web component (`@r2wc/react-to-web-component`). Its own widget-registry/editors/viewers/facets architecture predates `shacl-everything` and is independent of it (no shared code, no workspace dependency between them). Uses Comunica's full `@comunica/query-sparql` for a per-property `stsr:endpoint` remote-SPARQL-source concept that `shacl-everything` deliberately does not have.
- **`packages/resource-fetcher`** (`@shapething/resource-fetcher`) — a SHACL-guided RDF resource fetcher: given a subject IRI and SPARQL source(s) (+ optional SHACL shapes), progressively builds longer queries to follow blank-node paths so a logical resource's scattered blank-node triples are fetched together, avoiding blank-node identity collisions across separate queries. Consumed via `workspace:*` by `shacl-everything` (as a devDependency, for Storybook fixtures) and by `apps/resource-fetcher.shapething.com`.
- **`packages/local-store`** (`@shapething/localstore`) — an RDF/JS `Store` backed by Turtle files in a local/relative directory (File System Access API-style handles), queryable via Comunica. Standalone, no workspace deps.
- **`packages/text-store`** (`@shapething/textstore`) — wraps an N3 `Store` with Flexsearch for in-memory fuzzy full-text search over RDF literals. Standalone; also published independently to JSR.
- **`packages/typed-sparql`** (`@shapething/typed-sparql`) — dev-time code generation: parses `.rq` SPARQL files and generates RDF/JS-typed TypeScript result types, shipped both as a Vite plugin and a standalone module.
- **`apps/shacl-renderer.shapething.com`** (`@shapething/docs`, private) — Astro + Starlight docs/marketing site for `shacl-renderer`.
- **`apps/resource-fetcher.shapething.com`** (private) — small React/Vite demo app for `resource-fetcher`, querying live via Comunica in the browser.

When a task only touches one package, prefer working from that package's own directory/CLAUDE.md/README rather than reasoning about the whole monorepo.
