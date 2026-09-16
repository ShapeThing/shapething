/// <reference types="vitest/config" />
import { defineConfig } from "vite-plus";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { typedSparql } from "@shapething/typed-sparql";
import { serveExampleFixtures } from "./.storybook/serveExampleFixtures.ts";
import { corsProxy } from "./.storybook/corsProxy.ts";
const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [typedSparql()],
  pack: {
    dts: {
      tsgo: true,
    },
    exports: true,
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
