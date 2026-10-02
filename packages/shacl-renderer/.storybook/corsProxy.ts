import type { Plugin } from "vite";

// A same-origin stand-in for a paid CORS proxy service (corsproxy.io now requires an API key).
// The browser refuses to read a cross-origin response that lacks permissive CORS headers, but
// this dev-server middleware runs in Node, where CORS doesn't apply at all - it fetches the
// target itself, server to server, and hands the bytes back same-origin, so the browser never
// sees a cross-origin response in the first place. Point a loadGraph's corsProxyUrl at
// `${CORS_PROXY_PATH}` (a relative path resolves against the page's own origin) to use it - see
// src/stories/shacl-manager.stories.tsx.
export const CORS_PROXY_PATH = "/cors-proxy";

// Ontology namespace IRIs (skos:, dct:, foaf:, ...) are content-negotiated: without an RDF-shaped
// Accept header, a server defaults to serving its human-readable HTML documentation page instead
// of RDF, which rdf-parse then fails to parse as the turtle/RDF-XML/JSON-LD it's expecting.
// Ordered roughly by how common/unambiguous each serialization is to parse.
const RDF_ACCEPT =
  "text/turtle,application/n-triples,application/n-quads,text/n3," +
  "application/ld+json;q=0.9,application/rdf+xml;q=0.8,*/*;q=0.1";

export function corsProxy(): Plugin {
  return {
    name: "cors-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(`${CORS_PROXY_PATH}?`)) {
          next();
          return;
        }

        const target = new URL(req.url, "http://internal").searchParams.get("url");
        if (!target) {
          res.statusCode = 400;
          res.end("Missing ?url= query parameter");
          return;
        }

        try {
          const response = await fetch(target, { headers: { Accept: RDF_ACCEPT } });
          res.statusCode = response.status;
          res.setHeader(
            "Content-Type",
            response.headers.get("content-type") ?? "application/octet-stream",
          );
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          res.statusCode = 502;
          res.end(`Proxy fetch of ${target} failed: ${String(error)}`);
        }
      });
    },
  };
}
