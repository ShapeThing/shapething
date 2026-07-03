import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import sassGlobImports from 'vite-plugin-sass-glob-import';

// https://vite.dev/config/
export default defineConfig({
  root: "playground",
  plugins: [
    sassGlobImports(),
    react()],
  optimizeDeps: {
    include: ["@zazuko/env", "rdf-dataset-ext", "classnames"],
  },
  resolve: {
    alias: {
      lodash: "lodash-es",
      // it is not yet possible to correctly export CSS to JSR packages,
      "rdf-dataset-ext/addAll.js": "rdf-dataset-ext/addAll.js",
      "rdf-dataset-ext/deleteMatch.js": "rdf-dataset-ext/deleteMatch.js",
      "rdf-dataset-ext/equals.js": "rdf-dataset-ext/deleteMatch.js",
    },
  },
});
