import type { Quad, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { prefixes } from "@/helpers/namespaces.ts";

/**
 * A graph pre-parsed at build time (see build/ttlQuadsPlugin.ts, imported as `*.ttl?quads`):
 * a table of distinct terms plus a flat list of [subject, predicate, object, graph] indexes into
 * it. Lets the bundled widget scoring rules and group meta graphs ship without a turtle parser
 * running in the browser - decoding is a synchronous loop, no stream and no promise.
 *
 * Term encoding, by first character:
 * - `<` named node, rest is the IRI
 * - `_` blank node, rest is the label
 * - `"` literal, rest is JSON `[value, language, datatypeIri]`
 * - `D` the default graph
 */
export type EncodedQuads = { terms: string[]; quads: number[] };

function decodeTerm(encoded: string): Term {
  const rest = encoded.slice(1);
  switch (encoded[0]) {
    case "<":
      return factory.namedNode(rest);
    case "_":
      return factory.blankNode(rest);
    case '"': {
      const [value, language, datatype] = JSON.parse(rest) as [string, string, string];
      return factory.literal(value, language || factory.namedNode(datatype));
    }
    case "D":
      return factory.defaultGraph();
    default:
      throw new Error(`Unknown encoded term: ${encoded}`);
  }
}

export function decodeQuads({ terms, quads }: EncodedQuads): Quad[] {
  const decodedTerms = terms.map(decodeTerm);
  const result: Quad[] = [];
  for (let index = 0; index < quads.length; index += 4) {
    result.push(
      factory.quad(
        decodedTerms[quads[index]!] as Quad["subject"],
        decodedTerms[quads[index + 1]!] as Quad["predicate"],
        decodedTerms[quads[index + 2]!] as Quad["object"],
        decodedTerms[quads[index + 3]!] as Quad["graph"],
      ),
    );
  }
  return result;
}

export function storeFromQuads(...quadLists: Quad[][]): RdfStore {
  const store = RdfStore.createDefault();
  for (const quads of quadLists) for (const quad of quads) store.addQuad(quad);
  return store;
}

/**
 * One store from several small static graphs (see Widgets' scoringGraph/metaGraph), each turtle or
 * already parsed quads. Quads are added directly; turtle - only ever from a caller-supplied custom
 * widget, the bundled ones ship quads - is concatenated and parsed in one go, loading the parser
 * on demand.
 */
export async function storeFromGraphSources(
  sources: Array<string | Quad[] | undefined>,
): Promise<RdfStore> {
  const store = storeFromQuads(...sources.filter((source) => Array.isArray(source)));
  const turtle = sources.filter((source) => typeof source === "string").join("\n");
  if (turtle.trim()) {
    // Custom turtle used to be parsed concatenated after widget-scoring.ttl, so it could lean on
    // that file's PREFIX declarations - every well-known prefix is declared up front instead.
    const declarations = Object.entries(prefixes)
      .map(([prefix, iri]) => `PREFIX ${prefix}: <${iri}>`)
      .join("\n");
    const { parseRdf } = await import("@/helpers/rdf.ts");
    for (const quad of (await parseRdf(`${declarations}\n${turtle}`, "text/turtle")).getQuads())
      store.addQuad(quad);
  }
  return store;
}
