import { existsSync, readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import type { Plugin } from "vite";

const FIXTURE_CONTENT_TYPES: Record<string, string> = {
  ".ttl": "text/turtle; charset=utf-8",
};

// Story loadGraph() implementations resolve local example files with
// `new URL(relativePath, import.meta.url)`. Under `storybook dev` this works because Vite serves
// src/ files verbatim at their natural root-relative URL - but the Vitest browser-mode server used
// by `vp test`'s storybook-interaction project (see vite.config.ts) resolves a story module's
// import.meta.url to its raw absolute filesystem path instead, so the same call resolves to
// http://localhost:PORT/absolute/fs/path/to/fixture.ttl - a request shape Vite's default static
// middleware doesn't recognise (neither root-relative nor /@fs/-prefixed), so it 404s. This serves
// any such request whose decoded path exists on disk inside `examplesDir`.
export function serveExampleFixtures(examplesDir: string): Plugin {
  return {
    name: "serve-example-fixtures",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const pathname = decodeURIComponent(req.url.split("?")[0] ?? "");
        const contentType = FIXTURE_CONTENT_TYPES[extname(pathname)];
        if (!contentType || !pathname.startsWith(examplesDir)) return next();
        if (!existsSync(pathname) || !statSync(pathname).isFile()) return next();
        res.setHeader("Content-Type", contentType);
        res.end(readFileSync(pathname));
      });
    },
  };
}
