import type { Quad } from "@rdfjs/types";
import { Parser } from "n3";
import { factory } from "@/helpers/factory.ts";

// Turtle and its relatives are by far the most common input, and N3.js parses them directly and
// synchronously - rdf-parse would hand them to that very same N3.js parser anyway, but only after
// pulling in Comunica's whole parser bus (JSON-LD, RDFa, RDF/XML, microdata, SHACL-C, HTML) plus the
// Node stream and Buffer/process polyfills it needs. That stack is now loaded only when a source
// really is in one of those other formats (see rdfParseFallback.ts).
const n3Formats: Record<string, string> = {
  "text/turtle": "Turtle",
  "application/x-turtle": "Turtle",
  "application/n-triples": "N-Triples",
  "application/n-quads": "N-Quads",
  "text/x-nquads": "N-Quads",
  "application/trig": "TriG",
  "application/x-trig": "TriG",
  "text/n3": "N3",
};

const n3Extensions: Record<string, string> = {
  ttl: "text/turtle",
  turtle: "text/turtle",
  nt: "application/n-triples",
  ntriples: "application/n-triples",
  nq: "application/n-quads",
  nquads: "application/n-quads",
  trig: "application/trig",
  n3: "text/n3",
};

// Extensions rdf-parse maps to one of its other formats - such a path always goes there, whatever
// the Content-Type says. Any other extension (.php, .cgi, none at all...) carries no format, so the
// Content-Type decides.
const otherRdfExtensions = new Set([
  "jsonld",
  "json",
  "rdf",
  "owl",
  "xml",
  "rdfxml",
  "html",
  "htm",
  "xhtml",
  "xht",
  "svg",
  "shaclc",
  "shce",
]);

export type ParseTextOptions = {
  /** The media type, e.g. from a Content-Type header. */
  contentType?: string;
  /** The document's URL or file path, used to detect the format from its extension. */
  path?: string;
  baseIRI?: string;
};

function extensionOf(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const pathname = path.split(/[?#]/)[0]!;
  return /\.([A-Za-z0-9]+)$/
    .exec(pathname.slice(pathname.lastIndexOf("/") + 1))?.[1]
    ?.toLowerCase();
}

/**
 * The quads of an RDF document. The format comes from `path`'s extension when it has one (a more
 * reliable signal than whatever a static file server defaults its Content-Type to), else from
 * `contentType` - the same precedence rdf-parse applies.
 */
export async function parseRdfText(text: string, options: ParseTextOptions): Promise<Quad[]> {
  const extension = extensionOf(options.path);
  const contentType =
    (extension && n3Extensions[extension]) ||
    (extension && otherRdfExtensions.has(extension)
      ? undefined
      : options.contentType?.split(";")[0]!.trim().toLowerCase());
  const format = contentType ? n3Formats[contentType] : undefined;

  if (format) {
    return new Parser({ format, baseIRI: options.baseIRI, factory }).parse(text);
  }

  // An extension N3.js doesn't handle (.jsonld, .rdf, .owl, .html, ...) or a non-Turtle media type.
  const { parseWithRdfParse } = await import("@/helpers/rdfParseFallback.ts");
  return parseWithRdfParse(text, options);
}
