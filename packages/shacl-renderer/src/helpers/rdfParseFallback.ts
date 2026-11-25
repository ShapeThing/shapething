import "@/polyfills/ensureProcess.ts";
import "@/polyfills/ensureBuffer.ts";
import type { Quad } from "@rdfjs/types";
import { rdfParser, type ParseOptions } from "rdf-parse";
import stringToStream from "string-to-stream";
import { RdfStore } from "rdf-stores";
import type { ParseTextOptions } from "@/helpers/parseRdfText.ts";

/**
 * Every RDF format besides the Turtle family, through rdf-parse. Only ever loaded on demand (see
 * parseRdfText.ts), together with the Node stream/Buffer/process polyfills it needs.
 */
export async function parseWithRdfParse(text: string, options: ParseTextOptions): Promise<Quad[]> {
  const parseOptions: ParseOptions =
    options.path && (rdfParser.getContentTypeFromExtension(options.path) || !options.contentType)
      ? { path: options.path, baseIRI: options.baseIRI }
      : {
          contentType: options.contentType?.split(";")[0]!.trim() ?? "text/turtle",
          baseIRI: options.baseIRI,
        };

  const store = RdfStore.createDefault();
  await new Promise((resolve, reject) => {
    store
      .import(rdfParser.parse(stringToStream(text), parseOptions))
      .on("end", resolve)
      .on("error", reject);
  });
  return store.getQuads();
}
