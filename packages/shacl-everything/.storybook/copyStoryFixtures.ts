import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { Plugin } from "vite";

// argsByTestFile.ts resolves fixtures with `new URL(filename, import.meta.url)`. In dev this
// works because Vite serves src/ files verbatim, but a production build never imports these .ttl
// files through ESM, so Vite has no reason to copy them - the built stories.js chunks end up
// sibling-less in assets/, and the runtime fetch() for the fixture 404s. Emitting them here as
// build assets (flat, unhashed, matching the literal filename used at each call site) keeps them
// sibling to the chunk that references them.
export function copyStoryFixtures(storiesDir: string): Plugin {
  return {
    name: "copy-story-fixtures",
    apply: "build",
    buildStart() {
      const files = readdirSync(storiesDir, { recursive: true, encoding: "utf8" }).filter(
        (file) => extname(file) === ".ttl",
      );
      for (const file of files) {
        this.emitFile({
          type: "asset",
          fileName: `assets/${basename(file)}`,
          source: readFileSync(join(storiesDir, file)),
        });
      }
    },
  };
}
