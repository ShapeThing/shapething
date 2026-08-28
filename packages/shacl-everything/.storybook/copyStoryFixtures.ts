import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { Plugin } from "vite";

// argsByTestFile.ts resolves fixtures with `new URL(filename, import.meta.url)`. In dev this
// works because Vite serves src/ files verbatim, but a production build never imports these .ttl
// files through ESM, so Vite has no reason to copy them - the built stories.js chunks end up
// sibling-less in assets/, and the runtime fetch() for the fixture 404s. Emitting them here as
// build assets (flat, unhashed, matching the literal filename used at each call site) keeps them
// sibling to the chunk that references them.
//
// Fixtures aren't confined to src/stories/ - widget-specific ones are colocated with their
// widget (src/widgets/implementations/.../<Name>/), alongside that widget's own score.ttl. A
// fixture is a .ttl file that sits next to a *.stories.tsx AND isn't literally named score.ttl -
// score.ttl is a reserved widget-scoring filename (registry.ts glob-imports it directly via
// `?raw`, already inlined into the JS bundle) that happens to share a directory with the moved
// story but was never meant to be served as a standalone asset; every widget has one, so
// including it would collide on the same flattened `assets/score.ttl` output name.
export function copyStoryFixtures(srcDir: string): Plugin {
  return {
    name: "copy-story-fixtures",
    apply: "build",
    buildStart() {
      const files = readdirSync(srcDir, { recursive: true, encoding: "utf8" });
      const storyDirs = new Set(
        files.filter((file) => file.endsWith(".stories.tsx")).map((file) => dirname(file)),
      );
      const fixtures = files.filter(
        (file) =>
          extname(file) === ".ttl" &&
          basename(file) !== "score.ttl" &&
          storyDirs.has(dirname(file)),
      );
      for (const file of fixtures) {
        this.emitFile({
          type: "asset",
          fileName: `assets/${basename(file)}`,
          source: readFileSync(join(srcDir, file)),
        });
      }
    },
  };
}
