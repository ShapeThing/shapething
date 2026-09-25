/// <reference types="vitest/config" />
import { build, defineConfig } from "vite-plus";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { serveAbsoluteStoryFixtures } from "./.storybook/serveAbsoluteStoryFixtures.ts";
const dirname = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));
import Icons from "unplugin-icons/vite";
import react from "@vitejs/plugin-react";
import { corsProxy } from "./.storybook/corsProxy.ts";

// Vite's dev server understands the `?raw` suffix (import a file's contents as a string)
// natively, but `vp pack`'s tsdown/rolldown bundler doesn't - it has no equivalent to Vite's
// built-in `vite:asset` plugin. This reimplements just the `?raw` part so `*.ttl?raw` imports
// (see src/widgets/registry.ts) also resolve when packing the library for publish.
function rawImportFallback() {
  return {
    name: "raw-import-fallback",
    async resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith("?raw")) return null;
      const resolved = await this.resolve(
        source.slice(0, -"?raw".length),
        importer,
        {
          skipSelf: true,
        },
      );
      return resolved ? `${resolved.id}?raw` : null;
    },
    async load(id: string) {
      if (!id.endsWith("?raw")) return null;
      const content = await fs.readFile(id.slice(0, -"?raw".length), "utf-8");
      return `export default ${JSON.stringify(content)};`;
    },
  };
}

// `?worker&url` (see src/helpers/configureMaplibreWorker.ts) is, like `?raw`, a Vite-only import
// query: Vite bundles the referenced module into its own self-contained worker script and hands
// back that script's URL. `vp pack` doesn't understand it, and left alone it survives verbatim into
// dist - where it breaks every non-Vite consumer (webpack, esbuild, native ESM/import maps), and
// even a Vite consumer only by coincidence. Instead, at pack time the worker entry is bundled into
// one self-contained ES module (maplibre-gl's own worker imports its shared chunk, so the raw file
// alone isn't enough) and inlined as a string, exposed as a same-origin `blob:` URL - no served
// asset, no bundler cooperation needed, and it's only evaluated when the lazily-loaded map widget
// chunk that imports it is. Trade-off: that chunk carries the worker source (~490 kB minified), and
// a page with a strict CSP must allow `worker-src blob:` - or call maplibre-gl's own setWorkerUrl()
// itself first, which configureMaplibreWorker.ts then leaves alone.
function workerUrlFallback() {
  const suffix = "?worker&url";
  const prefix = "\0worker-url:";
  return {
    name: "worker-url-fallback",
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith(suffix)) return null;
      // Resolved with Node's own resolution rather than this.resolve(): the bare dependency path
      // minus its query is itself an externalized dependency import, which this.resolve() would
      // hand back unresolved.
      const require = createRequire(importer ?? path.join(dirname, "package.json"));
      return `${prefix}${require.resolve(source.slice(0, -suffix.length))}`;
    },
    async load(id: string) {
      if (!id.startsWith(prefix)) return null;
      const entry = id.slice(prefix.length);
      const result = await build({
        configFile: false,
        logLevel: "silent",
        root: dirname,
        build: {
          write: false,
          minify: true,
          copyPublicDir: false,
          modulePreload: false,
          // Library mode: no app-only preload/`document` helpers injected into worker code.
          lib: { entry, formats: ["es"], fileName: "worker" },
          rolldownOptions: { output: { codeSplitting: false, minify: true } },
        },
      });
      const outputs = (Array.isArray(result) ? result : [result]) as Array<{
        output: Array<{ type: string; code?: string }>;
      }>;
      const chunks = outputs.flatMap((o) => o.output).filter((c) => c.type === "chunk");
      if (chunks.length !== 1) {
        throw new Error(`Expected one self-contained worker chunk for ${entry}, got ${chunks.length}`);
      }
      return [
        `const source = ${JSON.stringify(chunks[0]!.code)};`,
        `export default URL.createObjectURL(new Blob([source], { type: "text/javascript" }));`,
      ].join("\n");
    },
  };
}

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react(), Icons({ compiler: "jsx", jsx: "react" }), corsProxy()],
  resolve: {
    alias: {
      "@": path.join(dirname, "src"),
    },
  },
  // maplibre-gl loads its own worker via `new Worker(new URL(...))` on its own module graph -
  // Vite's esbuild-based dep pre-bundler doesn't follow that nested worker reference and warns
  // ("might be incompatible with the dep optimizer"), so it's excluded from pre-bundling
  // entirely rather than pre-bundled incorrectly (see MapViewer/GeoEditor's own widget.tsx).
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  pack: {
    entry: ["src/index.ts", "src/tools.ts", "src/webcomponent.tsx"],
    dts: {
      tsgo: true,
    },
    exports: true,
    plugins: [
      Icons({ compiler: "jsx", jsx: "react" }),
      rawImportFallback(),
      workerUrlFallback(),
    ],
    // Third-party CSS a widget imports for its side effect (e.g. maplibre-gl/dist/maplibre-gl.css)
    // is bundled into dist/style.css alongside this package's own styles, instead of surviving
    // as a bare `import "pkg/x.css"` in a lazy chunk - which only a CSS-aware bundler can load,
    // and breaks outright under native ESM / Node. `?worker&url` imports likewise must not be
    // externalized (dependency imports are by default), so workerUrlFallback gets to resolve them.
    // onlyBundle lists exactly these, so any *other* dependency accidentally getting bundled fails
    // the build instead of silently bloating dist.
    deps: {
      alwaysBundle: [/\.css$/, /\?worker&url$/],
      onlyBundle: [/\.css$/, /\?worker&url$/, "maplibre-gl"],
    },
  },
  fmt: {},
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          exclude: ["**/*.stories.*", "node_modules/**"],
        },
      },
      {
        extends: true,
        resolve: {
          alias: {
            // See src/polyfills/emptyUtilModule.ts for why this is needed.
            util: path.join(dirname, "src/polyfills/emptyUtilModule.ts"),
          },
        },
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
          serveAbsoluteStoryFixtures(path.join(dirname, "src")),
        ],
        test: {
          name: "storybook",
          maxWorkers: 4,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
    ],
  },
});
