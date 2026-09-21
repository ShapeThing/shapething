import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
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
// fixture is a .ttl (or a media/stylesheet/locale asset a fixture references, e.g. ImageViewer's
// own hendrik.svg, a showcase's st:cssImport target, or a showcase-local .ftl interface
// translation loaded only by that showcase's own `interfaceLocales` override) that sits next to a
// *.stories.tsx AND isn't literally named score.ttl - score.ttl is a reserved widget-scoring
// filename (registry.ts glob-imports it directly via `?raw`, already inlined into the JS bundle)
// that happens to share a directory with the moved story but was never meant to be served as a
// standalone asset; every widget has one, so including it would collide on the same flattened
// `assets/score.ttl` output name.
const FIXTURE_EXTENSIONS = new Set([
  ".ttl",
  ".svg",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".css",
  ".ftl",
]);

// A fixture isn't always a direct sibling of its *.stories.tsx - e.g. src/stories/meta/'s
// examples/<name>/model.ttl (+ examples/<name>/imports/*.ttl) are grouped into their own
// subdirectories per example. Walk up from the fixture's directory to find the nearest ancestor
// that actually holds a story file; a fixture with no story anywhere above it isn't a fixture.
function findOwningStoryDir(fileDir: string, storyDirs: Set<string>): string | undefined {
  let dir = fileDir;
  while (true) {
    if (storyDirs.has(dir)) return dir;
    if (dir === ".") return undefined;
    dir = dirname(dir);
  }
}

export function copyStoryFixtures(srcDir: string): Plugin {
  return {
    name: "copy-story-fixtures",
    apply: "build",
    buildStart() {
      const files = readdirSync(srcDir, { recursive: true, encoding: "utf8" });
      const storyDirs = new Set(
        files.filter((file) => file.endsWith(".stories.tsx")).map((file) => dirname(file)),
      );
      for (const file of files) {
        if (!FIXTURE_EXTENSIONS.has(extname(file)) || basename(file) === "score.ttl") continue;
        const owningStoryDir = findOwningStoryDir(dirname(file), storyDirs);
        if (owningStoryDir === undefined) continue;
        // Preserve the fixture's path relative to its owning story dir (rather than flattening to
        // its basename) - both so two examples' same-named model.ttl don't collide in assets/, and
        // so a fixture's own relative references (e.g. model.ttl's `owl:imports <./imports/...>`)
        // still resolve correctly once served from assets/.
        this.emitFile({
          type: "asset",
          fileName: `assets/${relative(owningStoryDir, file)}`,
          source: readFileSync(join(srcDir, file)),
        });
      }
    },
  };
}
