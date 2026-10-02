// maplibre-gl resolves its own worker script's URL at runtime, relative to `import.meta.url` of
// whichever chunk it ends up bundled into (see node_modules/maplibre-gl/dist/maplibre-gl.mjs) -
// that computed path is never a literal `new URL('./x.mjs', import.meta.url)` a bundler can
// statically detect, so Rollup/Vite never emits maplibre-gl-worker.mjs as a real build asset. In a
// production build this leaves the runtime request 404ing (or, behind an SPA-fallback host,
// resolving to index.html - a "disallowed MIME type" error in the browser console). Both
// GeoEditor's and MapViewer's widget.tsx import this module for its side effect only, before
// constructing any maplibregl.Map, to point maplibre-gl at a worker that is actually reachable
// (see maplibre-gl-geo-editor's own README for this exact fix).
//
// `?worker&url` is resolved by Vite itself in dev/Storybook/tests; in the published build it's
// replaced at pack time by an inlined, self-contained `blob:` URL (see vite.config.ts's
// workerUrlFallback), so dist carries no Vite-only import query. An embedder that needs a
// different worker source (e.g. a strict CSP without `worker-src blob:`) can call maplibre-gl's
// own setWorkerUrl() before any map widget loads - a URL already set there is left alone.
import { getWorkerUrl, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

if (!getWorkerUrl()) setWorkerUrl(workerUrl);
