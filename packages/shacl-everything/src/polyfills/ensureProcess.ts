// Ensure a global `process` with a working `nextTick` exists.
//
// resolveRdfSources.ts uses `string-to-stream` and `rdf-parse` (Comunica), which pull in
// `readable-stream`. Even its browser build calls `process.nextTick` and reads a global `process`,
// which browsers do not provide. Bundler tooling (e.g. Vite's `define`) often injects a
// *partial* `process` (`{ env: {} }`) with no `nextTick`, which defeats naive
// `if (!window.process)` polyfills. So we augment whatever `process` exists rather than replace it,
// and only add `nextTick` when it is missing. This lets consumers use the library without adding a
// `process` polyfill of their own, in any consumption mode (dev, build, npm link, any bundler).
//
// Imported for its side effect as the first import of resolveRdfSources.ts, so it runs before
// `readable-stream` is evaluated.
//
// Source: https://github.com/smessie/shacl-ui.js/blob/main/lib/core/ensure-process.ts
const g = globalThis as unknown as {
  process?: { env?: unknown; nextTick?: unknown };
};

g.process ??= {};
g.process.env ??= {};
if (typeof g.process.nextTick !== "function") {
  // `queueMicrotask` gives the same "defer to a microtask" semantics readable-stream relies on.
  g.process.nextTick = (cb: (...args: unknown[]) => void, ...args: unknown[]) =>
    queueMicrotask(() => cb(...args));
}
