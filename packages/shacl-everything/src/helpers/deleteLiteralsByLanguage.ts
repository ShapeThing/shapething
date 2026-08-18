import type { RdfStore } from "rdf-stores";
import type { BCP47 } from "@/types/BCP47.ts";

/**
 * Removes every quad in `dataGraph` whose object is a Literal tagged with exactly `language`
 * (case-insensitive) - a dialect sharing the same primary subtag (e.g. "en-US" while deleting
 * "en-GB") is left untouched, since this is destructive and should only ever affect the language
 * actually picked. Goes through removeQuad() one match at a time rather than RdfStore's own
 * removeMatches() - only removeQuad() is wrapped for reactivity (see helpers/reactiveRdfStore.ts),
 * so removeMatches() would desync every component still reading the removed values.
 */
export function deleteLiteralsByLanguage(dataGraph: RdfStore, language: BCP47): void {
  const target = language.toLowerCase();
  const matches = dataGraph.getQuads().filter((quad) => {
    const object = quad.object;
    return object.termType === "Literal" && object.language.toLowerCase() === target;
  });

  for (const quad of matches) dataGraph.removeQuad(quad);
}
