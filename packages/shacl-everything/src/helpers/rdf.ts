import { rdfParser } from "rdf-parse";
import str from "string-to-stream";
import { RdfStore } from "rdf-stores";
import type { Stream } from "@rdfjs/types";

export async function parseRdf(content: string, contentType: string): Promise<RdfStore> {
  if (!content || content.trim().length === 0) {
    return RdfStore.createDefault();
  }

  const textStream = str(content);
  const quadStream = rdfParser.parse(textStream, { contentType });

  return streamToStore(quadStream);
}

function streamToStore(stream: Stream): Promise<RdfStore> {
  const store = RdfStore.createDefault();
  return new Promise((resolve, reject) => {
    store
      .import(stream)
      .on("end", () => resolve(store))
      .on("error", (error) => reject(error));
  });
}
