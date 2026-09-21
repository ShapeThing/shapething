import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname } from "node:path";
import type { Plugin } from "vite";

// Kept in sync with copyStoryFixtures.ts's FIXTURE_EXTENSIONS - same "what counts as a served
// fixture" rule, just also needing a Content-Type per extension here since this middleware (unlike
// a build-time emitted asset) answers the HTTP request directly.
const FIXTURE_CONTENT_TYPES: Record<string, string> = {
  ".ttl": "text/turtle; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".css": "text/css; charset=utf-8",
  ".ftl": "text/plain; charset=utf-8",
};

// argsByTestFile.ts resolves fixtures with `new URL(filename, import.meta.url)`. Under
// `storybook dev`'s own Vite server this works because Vite serves src/ files verbatim at their
// natural root-relative URL (see copyStoryFixtures.ts's comment for the production-build
// counterpart of this same gap) - but the Vitest browser-mode server used by `vp test`'s
// storybook-interaction project (see vite.config.ts) resolves a story module's import.meta.url to
// its raw absolute filesystem path instead of a root-relative dev URL, so the same
// `new URL(".ttl fixture", import.meta.url)` call resolves to
// http://localhost:PORT/absolute/fs/path/to/fixture.ttl - a request shape Vite's default static
// middleware doesn't recognise (it's neither root-relative nor /@fs/-prefixed), so it 404s.
// This serves any such request whose decoded path exists on disk as a fixture file (a .ttl, or a
// media asset a .ttl fixture references via a relative IRI, e.g. ImageViewer's own hendrik.svg)
// inside `srcDir` AND has a *.stories.tsx somewhere at or above its own directory AND isn't
// literally named score.ttl (i.e. is an argsByTestFile() fixture, not a widget's own reserved
// scoring file - see copyStoryFixtures.ts), so those fixtures resolve the same way under `vp test`
// as they already do in a real browser or a built Storybook.
//
// A fixture isn't always a direct sibling of its *.stories.tsx - e.g. src/stories/meta/'s
// examples/<name>/model.ttl (+ examples/<name>/imports/*.ttl) are grouped into their own
// subdirectories per example - so this walks up towards srcDir rather than checking dirname(pathname)
// alone. Kept in sync with copyStoryFixtures.ts's findOwningStoryDir.
function hasStoryAtOrAbove(dir: string, srcDir: string): boolean {
  let current = dir;
  while (true) {
    if (readdirSync(current).some((entry) => entry.endsWith(".stories.tsx"))) return true;
    if (current === srcDir) return false;
    const parent = dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

export function serveAbsoluteStoryFixtures(srcDir: string): Plugin {
  return {
    name: "serve-absolute-story-fixtures",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const pathname = decodeURIComponent(req.url.split("?")[0] ?? "");
        const contentType = FIXTURE_CONTENT_TYPES[extname(pathname)];
        if (!contentType || !pathname.startsWith(srcDir)) return next();
        if (basename(pathname) === "score.ttl") return next();
        if (!existsSync(pathname) || !statSync(pathname).isFile()) return next();
        if (!hasStoryAtOrAbove(dirname(pathname), srcDir)) return next();
        res.setHeader("Content-Type", contentType);
        res.end(readFileSync(pathname));
      });
    },
  };
}
