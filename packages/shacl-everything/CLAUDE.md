# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this package is

`@shapething/shacl-everything` — "A SHACL toolkit": a React library that reads a SHACL shapes graph + an RDF data graph and renders editable/viewable/faceted UI, plus live SHACL validation. It is a working reference implementation of the **SHACL 1.2 Core** spec and a proposed **SHACL-UI extension** (`shui:` = `http://www.w3.org/ns/shacl-ui/`) — widget selection, value-node labeling, language resolution, federated search, etc. are all literal implementations of specific numbered spec clauses, and source comments frequently cite them (e.g. `spec §4.3`, `spec §10.2`). When implementing or changing behavior here, the relevant spec clause — not "what seems reasonable" — is the source of truth; check `src/stories/SHACL 1.2. Core/` and `src/stories/SHACL 1.2 UI/` for the clause's existing fixture/test first (see "Story-driven spec conformance" below).

**`src/index.ts` is an unwired placeholder, not the real entry point** — it still contains the unmodified `vite-plus-starter` stub (`export const fn = () => "Hello, tsdown!"`), and the top-level `README.md` is likewise generic vite-plus boilerplate, neither ever updated since the package's earliest commits. Since `package.json`'s `exports` field points at this file's build output (`./dist/index.mjs`), **the published npm package currently exports nothing useful** — this is a real gap, not a stylistic choice, and worth flagging if asked about consuming the package externally.

The actual embedder-facing entry point is **`ShaclRenderer`** (default export, `src/outputs/render/render.tsx`), which Storybook stories import directly (`import ShaclRenderer from "@/outputs/render/render.tsx"`) since `src/index.ts` doesn't re-export it. `ShaclRendererProps = Partial<RawEnvironment> & { preprocessors?: readonly Preprocessor[] }` — an embedder mounts `<ShaclRenderer {...partialEnvironmentFields} />` with whichever `Environment` fields they need (typically `shapesGraph`, `dataGraph`, `focusNode`, `nodeShapes`, `mode`, `onSubmit`); everything else falls back to `defaultEnvironment` and the preprocessing chain. If asked to "export the public API" or similar, the real fix is re-exporting `ShaclRenderer`/`ShaclRendererProps` (and whatever else) from `src/index.ts` — not editing `index.ts`'s current placeholder in isolation.

## Commands (run from `packages/shacl-everything/`)

This package uses the **`vite-plus`** (`vp`) CLI for everything — build, dev, test, lint, and format/typecheck — unlike the rest of the monorepo, which only borrows `vp` for linting. Its own `vite-plus` devDependency version must stay in lockstep with the root's, or the native rolldown binding breaks (`Cannot find native binding` / `ERR_PACKAGE_PATH_NOT_EXPORTED`) — if `vp lint`/`vp check` fails at a config-resolution step rather than reporting real diagnostics, suspect a version mismatch first.

- `vp test` — run all tests once (unit + Storybook interaction tests).
- `vp test run <pattern>` — run just the test files matching `<pattern>` (filename substring), e.g. `vp test run PropertyUIElement`.
- `vp test -t "<name>"` — run tests whose name matches `<name>` (forwarded to Vitest's `--testNamePattern`).
- `vp test watch` — watch mode.
- Tests run as two separate Vitest **projects** (see `vite.config.ts`): `"unit"` (everything except `*.stories.*`, plain Node environment) and `"storybook"` (runs every `.stories.tsx`'s play-function interaction tests for real, in headless Chromium via `@vitest/browser-playwright` — requires Playwright's browser binaries to be installed). Target one explicitly with `vp test run --project unit` / `--project storybook` if needed.
- `vp lint --react-plugin --jsx-a11y-plugin` / `vp fmt` / `vp check` (format + lint + typecheck together).
- `vp pack` — build the library (`dts.tsgo: true`, i.e. declaration files via tsgo). `vp dev` — build in watch mode.
- `pnpm storybook` — Storybook dev server on port 6006. Both `storybook` and `build-storybook` first run `pnpm --filter @shapething/resource-fetcher build`, because Storybook fixtures depend on that workspace package's build output — if Storybook fails to find fixtures, check that build ran.
- Path alias: `@/*` → `src/*` (set in `vite.config.ts`'s `resolve.alias`, also used by `.storybook/`).

## Architecture

### Environment: the one object everything threads through

`environment.ts` defines `Environment` — the single config object passed down through the whole render tree (via `EnvironmentContextProvider` → `useEnvironment()`): the two core RDF graphs (`shapesGraph`, `dataGraph`, both `RdfStore` from the `rdf-stores` package), a derived `scoresGraph` (widget-scoring rules, see below), `focusNode`/`nodeShapes` (what's being rendered), `mode` (`"edit" | "view" | "facet"`), the interface-language and content-language state (see "Two independent language axes" below), and a set of `enable*` feature flags (widget switching, logical-branch switching, content-language creation, edit-in-place, etc). `defaultEnvironment` and `minimalEnvironment`/`minimalEnvironmentWithContentLanguages` are the two canonical presets used by stories/tests.

`RawEnvironment` is the pre-preprocessing shape: same as `Environment` except `shapesGraph`/`dataGraph`/`scoresGraph` may still be an unresolved `RdfSource` (a URL or string to dereference/parse) rather than a materialized `RdfStore`.

`EnvironmentContextProvider` (`outputs/render/contexts/EnvironmentContextProvider.tsx`) builds the `Environment` exactly once per mount (`useMemo`/`useSuspenseQuery` keyed by a stable instance id) and deliberately never rebuilds it from prop changes — `dataGraph` becomes a live, mutable, subscribed store that widgets edit in place, so re-deriving it on every render would silently discard in-progress edits. (Storybook's Controls addon only changes `args` and re-renders without remounting, so editing an arg there has no visible effect until a hard reload — `.storybook/preview.tsx` works around this Storybook-only limitation with a remount-on-args-change decorator, not a library-level fix.)

### Preprocessing pipeline (`preprocess/`)

`preprocess/index.ts`'s `runPreprocessors` turns a `RawEnvironment` into a ready `Environment` by running a fixed ordered chain (`defaultPreprocessors`), then makes `dataGraph` reactive:

1. `resolveRdfSources.ts` — dereferences/parses every `RdfSource` into a fully materialized local `RdfStore` (including fetching any configured URLs). Everything downstream assumes graphs are plain, synchronously-queryable `RdfStore`s — there is no "streaming" or "lazy remote graph" concept anywhere else in the codebase.
2. `languages.ts`'s `distillLanguages` / `distillInterfaceLanguages` — derive `contentLanguages` (languages found in `dataGraph`, union with caller-supplied ones) and `interfaceLanguages` (shipped/overridden `.ftl` locale keys ∪ every language tag on `sh:name`/`sh:description` in `shapesGraph`, deduped by primary subtag).
3. `scoresGraph.ts`'s `resolveScoresGraph` (fetches the bundled widget scoring graph for the current mode via `registry.ts`'s `getScoringGraph`, unless the caller already supplied one, or `mode === "facet"`) and `shapes.ts`'s `addMissingShapes` (currently a literal no-op — its own comment: `// TODO search for classes and predicates that do not have node and property shapes and add them to the shapes graph.`; don't assume it does anything yet).
4. `scoringGraphPreparation.ts`'s `prepareEnvironmentScoringGraph` — runs the spec's §4.3 "Scoring Graph Preparation" once per environment (see "Widget scoring" below) so a widget declared only via `shui:editor`/`shui:viewer` on a shape (with no `score.ttl` of its own) still gets picked up.
5. `configuration.ts`'s `assertValidEnvironment` validates the fully-resolved result.
6. `helpers/reactiveRdfStore.ts`'s `makeReactive(dataGraph)` — only `dataGraph` is ever written at runtime (e.g. `PropertyUIElement.addObject`); `shapesGraph`/`scoresGraph` are read-only for an `Environment`'s lifetime and stay plain.

### Structure layer (`structure/`): shape+data → a UI element tree

A pure, framework-agnostic model layer between the raw RDF (shapes+data) and the render tree — it does not touch React. `NodeUIElement` (`structure/NodeUIElement.ts`) is the tree root, one per rendered `nodeShape`; its `children()` flat-maps `childrenForShape` (`structure/childrenForShape.ts`) over every targeting node shape. `childrenForShape` is the recursive shape-expansion algorithm: it collects `sh:property` shapes (via `propertiesForShape`, which groups property shapes that share the *same path* — compared by canonical SPARQL rendering via `toSparql` — into one `PropertyUIElement`, since SHACL treats co-path property shapes as conjunctive constraints on one logical property), recurses into `sh:and`/`sh:node`-referenced shapes (flattened into the same focus node), and wraps each `sh:or`/`sh:xone` list as a lazy `ChoiceElement`. It assumes an acyclic shapes graph — no cycle guard.

Both `PropertyUIElement` and `ChoiceElement` carry a `kind: "property" | "choice"` **string discriminant, not relied on via `instanceof`** — Vite HMR can reload a class module while an already-constructed instance is still held in memoized React state, leaving `instanceof` against the freshly re-imported class returning `false`; any code branching on element type must switch on `.kind`.

`PropertyUIElement` (`structure/PropertyUIElement.ts`) is the workhorse: `get(predicate, languages?)` reads shape metadata (e.g. `sh:minCount`, `sh:name`) across all grouped shapes via a per-predicate conjunctive-merge table (`structure/constraintResolutions.ts` — keep-highest for `sh:minCount`, most-specific for `sh:class`, intersect for `sh:in`, etc.) or best-BCP47-match when `languages` is given. `getObjects`/`addObject`/`replaceObject`/`removeObject` read/write the property's values in `dataGraph`, all routed through `structure/paths/` — a full SHACL property-path algebra (`parsePropertyPath`, `walkPropertyPath`, `insertPropertyPath`, `replacePropertyPath`, `removePropertyPath`, `toSparql` for query-building), supporting sequence/alternative/inverse/`zeroOrMore`/`oneOrMore`/`zeroOrOne` paths — not just simple predicates. `widget()`/`widgets()` are the async calls that pick which `WidgetComponent`(s) render this property, by calling into `scoring/score.ts` (next section) — `widget()` returns the single winner (`select()`, `best: true`); `widgets()` returns every scored candidate (`score()`, used by `WidgetSwitcher` to list options).

`ChoiceElement` (`structure/ChoiceElement.ts`) represents one node-level `sh:or`/`sh:xone`: its `.children()` eagerly expands *every* branch's `childrenForShape(...)` result (not just the active one), so `ChoiceElementComponent` can switch branches without recomputing structure; `structure/choiceBranches.ts` provides `detectActiveChoiceBranch()` (first branch shape the focus node validates against wins). `structure/logicalBranches.ts` is the property-level analogue — `sh:or`/`sh:xone` declared *inside* a property shape, constraining one property's value rather than the whole node — with `withBranch()` merging a branch's triples into a `PropertyUIElement` view and `detectActiveBranch()` validating a candidate term against each branch.

### Widget scoring & selection (`scoring/score.ts` + `widgets/`)

Widget selection is **declarative and SHACL-native**, not imperative JS matching: each widget implementation folder (`widgets/implementations/shui/{editors,viewers}/<Name>/`) ships a `score.ttl` of `shui:WidgetScore` rules. Each rule is itself a SHACL `NodeShape` (`shui:shapesGraphShape`, tested against the property shape, or `shui:dataGraphShape`, tested against the candidate value) that contributes a signed integer `shui:score` when it validates — e.g. `TextFieldEditor/score.ttl` scores `-1` if `sh:singleLine false`, `+30` if the value is a plain string, `+40` if explicitly declared via `shui:editor`. `registry.ts` glob-imports every widget's `widget.tsx`/`score.ttl`/optional `meta.ts` under both `editors/` and `viewers/`, keyed by mode, and resolves a `shui:widget` IRI to its React component by matching local name to folder name.

`score()` ranks candidate widgets by summing matching rules (its `export` exists only so `score.test.ts`/`registry.test.ts` can unit-test ranking directly — real callers use `select()`, not this). `select()` is the actual entry point `PropertyUIElement.widget()` calls: with `best: true` it first tries the shape's own explicitly-declared `shui:editor`/`shui:viewer` before falling through to the `score()`-ranked list (`best: false` internally), then applies `accept()` — a `shui:WidgetAcceptMatcher` rule a widget can declare for a validity check beyond scoring (e.g. rejecting a value outside a dynamic `sh:in` set) — skipping a top-ranked-but-rejected widget in favor of the next-best rather than failing outright.

A `WidgetComponent` (`widgets/types.ts`) has props `{shape: PropertyUIElement, term, setTerm, labelledBy?}`. Optional `meta.ts` exports (`createTerm`, `canAddMore`, `singleUnifiedWidget`, `needsLanguageSwitcher`) cover cases the generic shape-derived default (`widgets/defaultTerm.ts`) can't — e.g. a widget whose fresh/empty value depends on the active content language, or one that renders once for the whole property instead of once per value.

**Current inventory**, under `widgets/implementations/shui/`: 16 editors (`AutoCompleteEditor`, `BlankNodeEditor`, `BooleanEditor`, `DatePickerEditor`, `DateTimePickerEditor`, `DetailsEditor`, `EnumSelectEditor`, `InstancesSelectEditor`, `IRIEditor`, `NumberFieldEditor`, `RichTextEditor`, `SubClassEditor`, `TextAreaEditor`, `TextAreaWithLangEditor`, `TextFieldEditor`, `TextFieldWithLangEditor`) and 10 read-only viewers (`BlankNodeViewer`, `DetailsViewer`, `HTMLViewer`, `HyperlinkViewer`, `ImageViewer`, `IRIViewer`, `LabelViewer`, `LangStringViewer`, `LiteralViewer`, `ValueTableViewer`), covering text/number/boolean/date(time)/IRI/rich-text input, nested blank-node/object editing (inline via `DetailsEditor`, taxonomy-style via `SubClassEditor`), static- and query-driven enumerations, and local/federated instance search.

### Rendering (`outputs/render/`)

`render.tsx`'s `ShaclRenderer` composes, outermost to innermost: an `ErrorBoundary` (react-error-boundary) → a TanStack Query `QueryClientProvider` (used everywhere for suspense-based async resolution — widget scoring, preprocessing, locale bundles) → `InterfaceLanguageProvider` → `L10nProvider` → `EnvironmentContextProvider` → a mode switch on `Environment.mode` that renders `modes/edit/index.tsx`, `modes/view/index.tsx`, or `modes/facet/index.tsx`.

**Only `edit` mode is actually implemented** — `view/` and `facet/` are literal placeholder stubs today (`ViewModeWrapper`/`FacetModeWrapper` just render `children`; their `NodeUIComponent.tsx` is a hardcoded `<h1>Node UI Component</h1>`). `useWidget` explicitly returns `undefined` for `mode === "facet"`, and the scoring preprocessors (`resolveScoresGraph`, `prepareEnvironmentScoringGraph`) skip facet mode entirely — don't assume feature parity across modes when reasoning about behavior; check which mode a story/bug report actually uses.

The edit-mode render tree, top to bottom:

```
EditModeWrapper (modes/edit/index.tsx)        — <form>, wraps in ValidationContextProvider, diffs dataGraph on submit
 └─ NodeUIComponent → NodeUIElementChildren → UIElementChildren   — walks NodeUIElement.children(), dispatches on `.kind`
     ├─ PropertyUIComponent  (kind: "property")
     │    └─ MemberShapeList (if sh:memberShape: dnd-kit-reorderable rdf:List) → MemberShapeListItem → WidgetSlot
     │    └─ or PropertyUIComponentValues (ordinary case; per-value loop, stable ordering, add/remove)
     │         └─ PropertyUIComponentObject (one value) → WidgetSlot
     │              └─ <ActiveWidget/> + WidgetSwitcher/LogicalConstraintSwitcher fly-out
     └─ ChoiceElementComponent  (kind: "choice", node-level sh:or/sh:xone)
          └─ UIElementChildren (recurses into the active branch)
```

`WidgetSlot` is the framework/widget boundary: it detects the active `sh:or`/`sh:xone` branch (`useActiveBranch`), merges the branch's constraints into an effective `PropertyUIElement` (`withBranch`), resolves the winning widget (`useWidget`), renders it, appends an `sh:unit` suffix if present, and shows a focus-within fly-out with `LogicalConstraintSwitcher` (manual branch override) and `WidgetSwitcher` (manual widget override, listing every scored candidate via `useWidgets`). `EditModeWrapper` diffs `dataGraph`'s quads against a mount-time snapshot (`helpers/diffQuads.ts`) to build the `SubmitResult` passed to `onSubmit`.

`contexts/` stacks the providers: `EnvironmentContextProvider`, `ContentLanguageProvider`/`InterfaceLanguageProvider` (kept separate on purpose, see below), `L10nProvider` (Fluent bundles), `ValidationContextProvider`. `hooks/` holds cross-cutting logic (see `query.ts` below, plus `useWidget`/`useWidgets`, `useDataGraphObjects`/`useReactiveRead`, `useDeferredInput` — local-state-then-commit-on-blur, used by text-ish widgets, `useSelectOptions`, `useInstanceSearch`, `usePropertyValidationResults`, etc). `components/` holds shared leaf UI (`FormElement` — the label/description/tooltip/severity wrapper used everywhere, `ValidationMessages`, `ValueChip`, `Modal`, `Tooltip`, `SelectListbox`, the language switchers).

### Live SHACL validation

`ValidationContextProvider` compiles one `shacl-engine` `Validator` per `shapesGraph` up front (reused for the `Environment`'s lifetime, since `shapesGraph` is read-only), then re-validates `dataGraph` — scoped to `focusNode`/`nodeShapes` — once on mount and again on every write, debounced 200ms. Results flow through `validationContext` and get filtered per-property by `usePropertyValidationResults`. Severity display text (Error/Warning/Info) comes from FTL bundles (`validation-severity-violation`/`-warning`/`-info` in `l10n/ftl/*.ftl`), not from the SHACL vocabulary itself — `sh:Violation`/`sh:Warning`/`sh:Info` have no `rdfs:label` in the spec, and UI chrome text is FTL's job in this codebase (see below).

### Value-node label resolution (`resolution/`)

`resolution/label.ts` implements the spec's "Value Node Labels" section: `valueNodeLabel`/`valueNodeSubLabel`/`valueNodeDepiction` find a property shape's `sh:node`, look for that node shape's own `sh:property` entries annotated `shui:propertyRole` (`shui:LabelRole`/`SubLabelRole`/`DepictionRole`), and walk that path (via `structure/paths/`) from the value term over `dataGraph` to find the best-language literal (or image IRI). `resolution/language.ts` + `resolution/globalConfiguration.ts` implement the spec's "8.1 Language Resolution" / "3.4 Global Configuration" clauses (a `shui:Configuration`/`sh:Graph` subject's `shui:languagePreference` ordered list, layered under the live UI-selected language). Don't hand-roll label/language lookup elsewhere — route through these.

### Federated & local search (`outputs/render/hooks/query.ts`)

One lazily-imported, cached `@comunica/query-sparql` engine handles **every** query this package runs — both plain local `dataGraph` lookups and federated (`SERVICE`-backed) ones. There is no per-property external-endpoint configuration concept (unlike `packages/shacl-renderer`'s `stsr:endpoint`); federation is entirely shape-author-declared SPARQL text (`sh:in [ sh:select "...SERVICE <endpoint>..." ]` or `shui:searchQuery`). Key functions: `resolveRoles` (batch-resolves LabelRole/SubLabelRole/DepictionRole for a known value set via one `VALUES` clause), `substituteSearchParameters` (fills `shui:searchQuery`'s `?searchTerm`/`?uiLanguage` placeholders via text substitution, since they're typically inside a `SERVICE` block a join can't reach into), `runFederatedQuery`, `searchInstances`/`fetchOptions` (local-only counterparts).

**Gotcha**: Comunica parses and re-serializes a `SERVICE` clause's query text before sending it over the wire, resolving prefixed names to full IRIs — this silently breaks Virtuoso's `bif:contains`-style magic predicates (which only work as the literal prefixed-name text). Use portable SPARQL 1.1 functions (`CONTAINS(LCASE(?x), LCASE(?y))`) in any `shui:searchQuery`/`sh:select` body instead.

### Two independent language axes

**Content language** (which `rdf:langString` translation of a data *value* is shown/edited, `useContentLanguage()`) and **interface language** (chrome/UI text — `sh:name` field labels, widget names, branch labels, `useInterfaceLanguage()`) are deliberately decoupled and must never be driven by the same switch. Anything sourced from `sh:name`/`sh:description`/`rdfs:label` that describes the *form* (not the data) follows interface language; actual literal values and value-node labels (`shui:LabelRole` etc.) follow content language. They live in sibling hooks/contexts precisely so they can't accidentally re-merge.

### Localization (`l10n/`)

Fluent (`.ftl`) bundles live in `l10n/ftl/{en-GB,nl-NL}.ftl` and are fetched at **runtime** via `fetch(new URL("./ftl/xx-XX.ftl", import.meta.url))` — not bundled/inlined into the JS — so a locale file is a served static asset, not a build-time import. `loadBundles.ts` resolves/merges/caches bundles for a given `interfaceLanguage`, always returning a fallback chain (negotiated locale + `DEFAULT_LOCALE`) so a lookup always resolves. `locales.ts`'s `mergeLocaleLoaders` lets a caller add/override/remove a built-in locale via `Environment.interfaceLocales` (e.g. `{"nl-NL": null}` to drop Dutch); `resolveLocale` does exact-match-then-primary-subtag negotiation. `L10nProvider` suspense-loads the bundles and provides them via `@fluent/react`'s `<LocalizationProvider>`; components then render `<Localized id="some-message-id">Fallback text</Localized>`, where the JSX children are the hardcoded fallback used if the id is missing from every loaded bundle.

### Theming (`theme/`)

Plain CSS via cascade layers (`@layer reset, components, actions, flyout, overlay`) — `open-props` supplies the raw design-token palette (spacing, color scales, radii) into the `reset` layer; `theme/index.css`'s `:root` then defines a thin ShapeThing-specific indirection on top (`--st-*` custom properties: primary/border/text colors, severities, a named z-index scale) plus shared component classes (`button.css`/`input.css`/`select.css`/`checkbox.css`/`listbox.css`) like `.st-input`/`.st-label`. Both framework components (`FormElement`) and individual widgets (e.g. `TextFieldEditor` sets `className="st-input"`) reference these classes directly, with `clsx` for conditional composition and `data-*` attributes (`data-severity`, `data-size`) for state-driven styling. No CSS-in-JS.

### Utilities and polyfills

`src/helpers/` is a flat directory of small, mostly-pure, individually-tested utilities used across every layer above — RDF plumbing (`factory.ts`, `namespaces.ts`, `rdfList.ts`, `termKey.ts`, `diffQuads.ts`), reactivity (`reactiveRdfStore.ts`'s `makeReactive`), language resolution (`bestByLanguage.ts`, `filterByContentLanguage.ts`, `parseBCP47.ts`), label/text derivation (`branchLabel.ts`, `localName.ts`, `highlightMatches.tsx`), and validation helpers (`severityFromTerm.ts`, `worstSeverity.ts`). `noRefetch.ts` is a shared TanStack Query options object (disables refetch-on-focus/mount) applied consistently to every suspense query in the codebase — reuse it rather than re-disabling refetch ad hoc on a new query.

`src/polyfills/` works around `preprocess/resolveRdfSources.ts`'s RDF-parsing chain (`rdf-parse`/`string-to-stream`/`readable-stream`, used by Comunica) assuming a Node-like environment: `ensureBuffer.ts` polyfills a global `Buffer`, `ensureProcess.ts` patches `process.nextTick` — both imported purely for side effects as the first imports of `resolveRdfSources.ts`. `emptyUtilModule.ts` is different: `readable-stream` maps `util` to `false` in its own package.json `"browser"` field, which Vite doesn't honor the way webpack/browserify do — `vite.config.ts`'s Storybook test project aliases `util` to this empty-object module to reproduce that intended no-op remap.

### Story-driven spec conformance (`src/stories/`)

`SHACL 1.2. Core/` and `SHACL 1.2 UI/` are organized by the **spec's own section numbers** — e.g. `7.7.3.a sh-or.ttl` + a `.stories.tsx`, or `10.1.1 shui-auto-complete-editor.ttl`/`.stories.tsx` — each pairing a shape/data fixture with a story, doubling as both the spec-conformance test suite and living documentation of coverage. When adding support for a new SHACL/SHUI clause, follow this same numbered-pair convention rather than inventing a new organizing scheme. `functionality/` covers cross-cutting behaviors not tied to one clause (language switching, submit, widget-switching, deprecated-property severity); `showcases/` has realistic end-to-end demo shapes.

**Storybook quirks worth knowing before debugging a story visually**:
- A story with a `play()` function (interaction test) auto-runs it the instant the story is viewed — anywhere, including a direct `iframe.html` load or screenshot. What you see is the *post-play end state*, not the story's declared `args`/fixture data. Read the `play()` script (or view a sibling story with no `play`) before treating rendered state as a bug.
- `.storybook/preview.tsx` has a project-level `argTypesEnhancer` specifically to stop Storybook's `inferArgTypes` from crashing on `RdfStore`'s real internal reference cycle (`store.dictionary.quotedTriplesReverseDictionaries[0].dictionary` points back to itself even when empty) — never pass a raw `RdfStore` as a literal story `arg` outside of what that enhancer already covers, since a separate, unfixable crash exists in Storybook's own Controls-panel `dequal` diffing for any raw `RdfStore` in `args`.
