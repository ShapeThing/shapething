import type { Plugin } from "vite";

// A dev-server page that copies a SPARQL query to the clipboard. The DevTools console can't run
// code when a logged link is clicked, it can only open the URL - so facet queries are logged (see
// logFacetQuery in src/facets/facetQueries.ts) as a link to this page, with the query itself in the
// URL's #fragment: the fragment never reaches the server, so no length limit, and this middleware
// just serves the same static page every time. Clicking it opens a focused tab, which is allowed
// to write the clipboard straight away; the button is the fallback for when it isn't.
export const SPARQL_COPY_PAGE_PATH = "/sparql-copy";

const PAGE = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>SPARQL query</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 16px; color-scheme: light dark; }
  pre { white-space: pre-wrap; padding: 12px; border: 1px solid #8884; border-radius: 6px; }
</style>
<button id="copy">Copy</button> <span id="status"></span>
<pre id="query"></pre>
<script>
  const query = decodeURIComponent(location.hash.slice(1));
  const status = document.getElementById("status");
  document.getElementById("query").textContent = query;
  const copy = () =>
    navigator.clipboard.writeText(query).then(
      () => (status.textContent = "Copied to clipboard"),
      () => (status.textContent = "Couldn't copy automatically, press Copy"),
    );
  document.getElementById("copy").addEventListener("click", copy);
  copy();
</script>
</html>
`;

export function sparqlCopyPage(): Plugin {
  return {
    name: "sparql-copy-page",
    apply: "serve",
    // Exposed as import.meta.env.SPARQL_COPY_PAGE so only a dev server that actually serves the
    // page makes the app log links to it - not a consumer's own Vite dev server, nor test runs.
    config() {
      if (process.env.VITEST) return;
      return { define: { "import.meta.env.SPARQL_COPY_PAGE": JSON.stringify(SPARQL_COPY_PAGE_PATH) } };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split(/[?#]/)[0] !== SPARQL_COPY_PAGE_PATH) {
          next();
          return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(PAGE);
      });
    },
  };
}
