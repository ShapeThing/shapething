// @shapething/shacl-everything's dereferenceUrl() pulls in readable-stream (via
// string-to-stream/rdf-parse), which maps `util` to `false` in its own package.json "browser"
// field - Vite doesn't honor that bare-specifier remap, so it falls back to its default
// browser-external stub, which warns on every property access even from readable-stream's own
// defensive `util.inspect`/`util.debuglog` checks. Aliasing `util` to this empty module (see
// vite.config.ts, storybook project) reproduces the remap readable-stream already intends,
// without the console spam.
export default {};
