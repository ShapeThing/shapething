import { defineConfig } from "vitest/config";
import { preview } from "@vitest/browser-preview";

export default defineConfig({
  test: {
    projects: [
      {
        // Pure helpers, no folder needed: run in Node.
        test: {
          name: "unit",
          include: ["lib/helpers/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        // The store itself needs the File System Access API of a browser.
        test: {
          name: "browser",
          include: ["lib/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            provider: preview(),
            instances: [{ browser: "chrome" }],
          },
        },
      },
    ],
  },
});
