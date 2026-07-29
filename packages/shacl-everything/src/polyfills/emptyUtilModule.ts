// `readable-stream` (pulled in transitively via string-to-stream/rdf-parse, used by
// resolveRdfSources.ts) maps `util` to `false` in its own package.json "browser" field,
// meaning bundlers should treat it as an empty module in the browser — its browser build
// only reads `util.inspect`/`util.debuglog` defensively and falls back gracefully when
// absent. Vite does not honor that bare-specifier "browser" field remap, so it instead
// falls back to its default browser-external stub, which warns on every property access
// even from those defensive checks. Aliasing `util` to this empty module (see
// vite.config.ts, storybook project) reproduces the remap readable-stream already intends,
// without the console spam.
export default {};
