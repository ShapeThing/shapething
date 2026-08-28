/// <reference types="vitest/config" />
import { defineConfig } from "vite-plus";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { serveAbsoluteStoryFixtures } from "./.storybook/serveAbsoluteStoryFixtures.ts";
const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
import Icons from "unplugin-icons/vite";
import react from "@vitejs/plugin-react";

// Vite's dev server understands the `?raw` suffix (import a file's contents as a string)
// natively, but `vp pack`'s tsdown/rolldown bundler doesn't - it has no equivalent to Vite's
// built-in `vite:asset` plugin. This reimplements just the `?raw` part so `*.ttl?raw` imports
// (see src/widgets/registry.ts) also resolve when packing the library for publish.
function rawImportFallback() {
  return {
    name: "raw-import-fallback",
    async resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith("?raw")) return null;
      const resolved = await this.resolve(source.slice(0, -"?raw".length), importer, {
        skipSelf: true,
      });
      return resolved ? `${resolved.id}?raw` : null;
    },
    async load(id: string) {
      if (!id.endsWith("?raw")) return null;
      const content = await fs.readFile(id.slice(0, -"?raw".length), "utf-8");
      return `export default ${JSON.stringify(content)};`;
    },
  };
}

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react(), Icons({ compiler: "jsx", jsx: "react" })],
  resolve: {
    alias: {
      "@": path.join(dirname, "src"),
    },
  },
  pack: {
    dts: {
      tsgo: true,
    },
    exports: true,
    plugins: [Icons({ compiler: "jsx", jsx: "react" }), rawImportFallback()],
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
