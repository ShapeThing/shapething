/// <reference types="vitest/config" />
import { defineConfig } from "vite-plus";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { typedSparql } from "@shapething/typed-sparql";
import { serveExampleFixtures } from "./.storybook/serveExampleFixtures.ts";
import { corsProxy } from "./.storybook/corsProxy.ts";
const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// l10n/locales.ts fetches locale bundles at runtime via `new URL("./ftl/xx-XX.ftl",
// import.meta.url)`, relative to wherever that code ends up compiled to - but `vp pack`'s
// tsdown/rolldown bundler, unlike Vite's own dev/app-build asset handling, never detects or
// copies a file that's only referenced through a runtime `new URL(...)` call (there's no static
// `import` for it to follow). Left alone, every *published* consumer of this package 404s trying
// to load its interface-language bundles. This mirrors src/l10n/ftl next to the built output so
// the existing relative fetch keeps resolving, without requiring a consumer to vendor/copy these
// files into their own public dir themselves.
function copyFtlAssets() {
  const ftlSourceDir = path.join(dirname, "src/l10n/ftl");
  return {
    name: "copy-ftl-assets",
    async writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? path.join(dirname, "dist");
      const destDir = path.join(outDir, "ftl");
      await fs.mkdir(destDir, { recursive: true });
      for (const file of await fs.readdir(ftlSourceDir)) {
        await fs.copyFile(path.join(ftlSourceDir, file), path.join(destDir, file));
      }
    },
  };
}

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  // corsProxy() only hooks configureServer, so it's a no-op for `vp pack`/production builds - it
  // just means any real `vite dev` server for this package (not just Storybook's own separately
  // configured one, see .storybook/main.ts) also serves a working /cors-proxy route.
  plugins: [typedSparql(), corsProxy()],
  pack: {
    entry: { index: "src/index.tsx" },
    dts: {
      tsgo: true,
    },
    exports: true,
    plugins: [typedSparql(), copyFtlAssets()],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  resolve: {
    alias: {
      "@": path.join(dirname, "src"),
    },
  },
  fmt: {},
  test: {
    projects: [
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
          serveExampleFixtures(path.join(dirname, "src/examples")),
          corsProxy(),
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
