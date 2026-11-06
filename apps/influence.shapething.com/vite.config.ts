import { typedSparql } from "@shapething/typed-sparql";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// typedSparql generates a .rq.d.ts next to every .rq file in src, so importing a query gives its
// typed rows (see src/sparql/select.ts).
export default defineConfig({
  plugins: [typedSparql(), react()],
  build: {
    sourcemap: true,
  },
});
