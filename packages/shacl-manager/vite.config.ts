/// <reference types="vitest/config" />
import { defineConfig } from "vite-plus";
import { typedSparql } from "@shapething/typed-sparql";

export default defineConfig({
  // Generates a .rq.d.ts next to every .rq file under src/ and lets `import query from "./x.rq"`
  // resolve to the query string, typed as TypedQuery<Row>.
  plugins: [typedSparql()],
  pack: {
    entry: { index: "src/index.tsx" },
    dts: {
      generator: "tsgo",
    },
    exports: true,
    plugins: [typedSparql()],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
