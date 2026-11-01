import { QueryEngine } from "@comunica/query-sparql-rdfjs";
import type { Literal, Quad, Stream, Term } from "@rdfjs/types";
import { TextStore, defaultSearchTerm } from "@shapething/textstore";
import { Charset, Encoder } from "flexsearch";
import { DataFactory } from "n3";
import { baseUri, getExampleStore, onStoreChange, storeVersion } from "./exampleStore";

const engine = new QueryEngine();

// Forward tokenizing with the LatinAdvanced encoder tolerates typos such as "otolenghi" or "welington".
// The more phonetic LatinExtra matches too much on this data, "qwe" would find 36 resources.
const indexOptions = {
  tokenize: "forward",
  encoder: new Encoder(Charset.LatinAdvanced, { minlength: 3 }),
} as const;

let textStore: { version: number; label: string; store: TextStore } | undefined;

/**
 * The TextStore wraps the example store, which is the picked folder or the in memory store.
 * It is created again when the data changed, so that the index is up to date.
 */
const getTextStore = () => {
  const { source, label } = getExampleStore();
  if (textStore?.version !== storeVersion)
    textStore = {
      version: storeVersion,
      label,
      store: new TextStore({ store: source, indexOptions }),
    };
  return textStore;
};

// Every document is its own graph, so the graph of a matching literal is the resource it belongs to.
// That includes the ingredients of a recipe, and it lets the store open only the files that matched.
export const searchQuery = (text: string) => `PREFIX schema: <http://schema.org/>
PREFIX tsst: <https://textstore.shapething.com/>

SELECT DISTINCT ?resource ?type ?name WHERE {
  GRAPH ?resource {
    ?match tsst:search ${JSON.stringify(text)} .
    ?resource a ?type ;
      schema:name ?name .
  }
  FILTER(LANG(?name) = "en")
}`;

export type SearchResult = {
  resource: string;
  type: string;
  name: string;
  matches: { property: string; value: string }[];
};

const toArray = (stream: Stream<Quad>): Promise<Quad[]> =>
  new Promise((resolve, reject) => {
    const quads: Quad[] = [];
    stream.on("data", (quad: Quad) => quads.push(quad));
    stream.on("end", () => resolve(quads));
    stream.on("error", reject);
  });

const shorten = (term: Term) =>
  term.value
    .replace(baseUri.toString(), "")
    .replace("http://schema.org/", "")
    .replace("http://example.org/", "");

/**
 * Finds resources with SPARQL and then asks the TextStore directly which literals matched, to show why they were found.
 */
export const search = async (text: string): Promise<{ label: string; results: SearchResult[] }> => {
  const { label, store } = getTextStore();
  if (!text.trim()) return { label, results: [] };

  const [bindings, matchingQuads] = await Promise.all([
    engine
      .queryBindings(searchQuery(text), { sources: [store] })
      .then((stream) => stream.toArray()),
    toArray(store.match(null, defaultSearchTerm, DataFactory.literal(text))),
  ]);

  const matches = new Map<string, SearchResult["matches"]>();
  for (const quad of matchingQuads) {
    const resource = quad.graph;
    const literal = quad.object as Literal;
    const prefix = quad.subject.termType === "BlankNode" ? "ingredient › " : "";
    const property = `${prefix}${shorten(quad.predicate)}${literal.language ? ` (${literal.language})` : ""}`;
    const resourceMatches = matches.get(resource.value) ?? [];
    if (
      !resourceMatches.some((match) => match.property === property && match.value === literal.value)
    ) {
      resourceMatches.push({ property, value: literal.value });
    }
    matches.set(resource.value, resourceMatches);
  }

  // One result per resource, with the matching literals of the resource and of its ingredients.
  const results = new Map<string, SearchResult>();
  for (const binding of bindings) {
    const resource = binding.get("resource")!;
    if (results.has(resource.value)) continue;
    results.set(resource.value, {
      resource: shorten(resource),
      type: shorten(binding.get("type")!),
      name: binding.get("name")!.value,
      matches: matches.get(resource.value) ?? [],
    });
  }

  return { label, results: [...results.values()] };
};

export { onStoreChange };
