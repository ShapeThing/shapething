/// <reference types="vitest/config" />
import { defineConfig } from "vite-plus";
import fs from "node:fs/promises";
import path from "node:path";
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

// l10n/locales.ts fetches locale bundles at runtime via `new URL("./ftl/xx-XX.ftl",
// import.meta.url)`, relative to wherever that code ends up compiled to - but `vp pack`'s
// tsdown/rolldown bundler, unlike Vite's own dev/app-build asset handling, never detects or
// copies a file that's only referenced through a runtime `new URL(...)` call (there's no
// static `import` for it to follow). Left alone, every *published* consumer of this package
// (as opposed to this package's own Storybook, which imports source directly and never hits
// this) 404s trying to load its interface-language bundles. This mirrors src/l10n/ftl next to
// the built output so the existing relative fetch keeps resolving, without requiring a
// consumer to vendor/copy these files into their own public dir themselves.
function copyFtlAssets() {
  const ftlSourceDir = path.join(dirname, "src/l10n/ftl");
  return {
    name: "copy-ftl-assets",
    async writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? path.join(dirname, "dist");
      const destDir = path.join(outDir, "ftl");
      await fs.mkdir(destDir, { recursive: true });
      for (const file of await fs.readdir(ftlSourceDir)) {
        await fs.copyFile(
          path.join(ftlSourceDir, file),
          path.join(destDir, file),
        );
      }
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
    dts: {
      tsgo: true,
    },
    exports: true,
    plugins: [
      Icons({ compiler: "jsx", jsx: "react" }),
      rawImportFallback(),
      copyFtlAssets(),
    ],
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
