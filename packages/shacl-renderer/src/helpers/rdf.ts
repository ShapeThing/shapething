import { RdfStore } from "rdf-stores";
import { parseRdfText } from "@/helpers/parseRdfText.ts";

export async function parseRdf(content: string, contentType: string): Promise<RdfStore> {
  const store = RdfStore.createDefault();
  if (!content || content.trim().length === 0) return store;
  for (const quad of await parseRdfText(content, { contentType })) store.addQuad(quad);
  return store;
}
