import { Buffer } from "buffer";

// Ensure a global `Buffer` exists.
//
// `string-to-stream` (used by resolveRdfSources.ts to feed text into rdf-parse) calls
// `Buffer.from(str, encoding)` directly, which browsers do not provide. `buffer` is the
// standard browser-safe polyfill (already pulled in transitively by n3/readable-stream),
// so we just expose it globally rather than adding bundler-level Node-polyfill config.
//
// Imported for its side effect as the first import of resolveRdfSources.ts, so it runs before
// `string-to-stream` is evaluated.
const g = globalThis as unknown as { Buffer?: unknown };

g.Buffer ??= Buffer;
