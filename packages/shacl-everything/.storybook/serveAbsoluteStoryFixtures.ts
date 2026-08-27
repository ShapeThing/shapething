import { existsSync, readFileSync, statSync } from "node:fs";
import type { Plugin } from "vite";

// argsByTestFile.ts resolves fixtures with `new URL(filename, import.meta.url)`. Under
// `storybook dev`'s own Vite server this works because Vite serves src/ files verbatim at their
// natural root-relative URL (see copyStoryFixtures.ts's comment for the production-build
// counterpart of this same gap) - but the Vitest browser-mode server used by `vp test`'s
// storybook-interaction project (see vite.config.ts) resolves a story module's import.meta.url to
// its raw absolute filesystem path instead of a root-relative dev URL, so the same
// `new URL(".ttl fixture", import.meta.url)` call resolves to
// http://localhost:PORT/absolute/fs/path/to/fixture.ttl - a request shape Vite's default static
// middleware doesn't recognise (it's neither root-relative nor /@fs/-prefixed), so it 404s.
// This serves any such request whose decoded path exists on disk as a .ttl file inside
// `storiesDir`, so argsByTestFile()-based fixtures resolve the same way under `vp test` as they
// already do in a real browser or a built Storybook.
export function serveAbsoluteStoryFixtures(storiesDir: string): Plugin {
  return {
    name: "serve-absolute-story-fixtures",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const pathname = decodeURIComponent(req.url.split("?")[0] ?? "");
        if (!pathname.endsWith(".ttl") || !pathname.startsWith(storiesDir)) return next();
        if (!existsSync(pathname) || !statSync(pathname).isFile()) return next();
        res.setHeader("Content-Type", "text/turtle; charset=utf-8");
        res.end(readFileSync(pathname));
      });
    },
  };
}
