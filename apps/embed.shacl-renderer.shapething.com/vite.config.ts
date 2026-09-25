import { defineConfig } from "vite";

// Builds a script that a third-party page loads with a single tag:
//
//   <script type="module" src="https://embed.shacl-renderer.shapething.com/shacl-renderer.js"></script>
//   <shacl-renderer shapes="..." data="..."></shacl-renderer>
//
// The entry keeps a stable, unhashed filename so that URL never changes; everything it lazily
// imports (modes, widgets, locale bundles) is hashed and resolved relative to the entry itself
// (base "./"), never relative to the embedding page.
export default defineConfig({
  base: "./",
  // Same as public/_headers in production: embedding pages load all of this cross-origin.
  preview: { cors: true },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        index: "index.html",
        "shacl-renderer": "src/shacl-renderer.ts",
      },
      // Keep the entry's side effects (customElements.define) in the entry chunk itself rather
      // than letting the bundler fold it into a shared chunk only index.html references.
      preserveEntrySignatures: "exports-only",
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "shacl-renderer" ? "shacl-renderer.js" : "assets/[name]-[hash].js",
      },
    },
  },
});
