/// <reference types="vitest/config" />
import { defineConfig } from "vite-plus";
import { typedSparql } from "@shapething/typed-sparql";
import fs from "node:fs/promises";

// `vp pack` doesn't understand `?raw` imports (the meta shapes' Turtle) the way Vite's dev server does.
function rawImportFallback() {
  return {
    name: "raw-import-fallback",
    async resolveId(
      this: {
        resolve: (
          source: string,
          importer?: string,
          options?: object,
        ) => Promise<{ id: string } | null>;
      },
      source: string,
      importer: string | undefined,
    ) {
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

export default defineConfig({
  // `import query from "./x.rq"` gives the query string, typed by a generated .rq.d.ts.
  plugins: [typedSparql()],
  pack: {
    entry: { index: "src/index.tsx" },
    dts: {
      generator: "tsgo",
    },
    exports: true,
    plugins: [typedSparql(), rawImportFallback()],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
