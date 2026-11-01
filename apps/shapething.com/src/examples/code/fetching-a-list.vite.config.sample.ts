import { typedSparql } from "@shapething/typed-sparql";
import { defineConfig } from "vite";

// Generates a .rq.d.ts file next to every .rq file in src, and updates it when the query changes.
export default defineConfig({
  plugins: [typedSparql()],
});
