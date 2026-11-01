import namespace from "@rdfjs/namespace";
import type { NamespaceBuilder } from "@rdfjs/namespace";
import type * as RDF from "@rdfjs/types";
import { Index } from "flexsearch";
import type { IndexOptions } from "flexsearch";
import { Store } from "n3";
/** @ts-expect-error readable-stream ships no type declarations */
import { Readable } from "readable-stream";

const tsst: NamespaceBuilder<string> = namespace("https://textstore.shapething.com/");
/**
 * The default IRI to use for searching with TextStore
 */
export const defaultSearchTerm: RDF.NamedNode = tsst("search");

type TextStoreOptions = {
  /**
   * The store to wrap, for example an N3 Store or a LocalStore. Defaults to an empty N3 Store.
   */
  store?: RDF.Source;
  indexOptions?: IndexOptions;
  searchTerm?: RDF.NamedNode;
};

const streamToArray = <T>(stream: RDF.Stream<T & RDF.Quad>): Promise<RDF.Quad[]> =>
  new Promise((resolve, reject) => {
    const quads: RDF.Quad[] = [];
    stream.on("data", (quad: RDF.Quad) => quads.push(quad));
    stream.on("end", () => resolve(quads));
    stream.on("error", reject);
  });

const literalKey = (literal: RDF.Literal) =>
  `${literal.value}\u0000${literal.language}\u0000${literal.datatype.value}`;

type QuadPattern = [
  subject?: RDF.Term | null,
  predicate?: RDF.Term | null,
  object?: RDF.Term | null,
  graph?: RDF.Term | null,
];

/**
 * Optional capabilities of the wrapped store, such as the N3 Store has.
 */
type StoreCapabilities = {
  add?: (quad: RDF.Quad) => unknown;
  delete?: (quad: RDF.Quad) => unknown;
  countQuads?: (...pattern: QuadPattern) => number;
};

/**
 * Wraps another store and adds fuzzy text search over its literals.
 * Matching with the search term as predicate and the search text as object returns the quads that have a matching literal as object.
 */
export class TextStore implements RDF.Source {
  #store: RDF.Source & StoreCapabilities;
  #searchTerm: RDF.NamedNode;
  #indexOptions: IndexOptions;
  #textIndex!: Index;
  #literals = new Map<number, RDF.Literal>();
  #literalIds = new Map<string, number>();
  #nextLiteralId = 0;
  #indexing?: Promise<void>;

  constructor(options: TextStoreOptions = {}) {
    // The N3 typings are stricter than RDF/JS, but the N3 Store is a valid RDF/JS store.
    this.#store = options.store ?? (new Store() as unknown as RDF.Source & StoreCapabilities);
    this.#searchTerm = options.searchTerm ?? defaultSearchTerm;
    this.#indexOptions = { tokenize: "full", ...options.indexOptions };
    this.#resetIndex();
  }

  /**
   * (Re)builds the text index from all literals in the wrapped store.
   * Call this when the wrapped store was changed without going through this TextStore.
   */
  reindex(): Promise<void> {
    this.#indexing = (async () => {
      const quads = await streamToArray(this.#store.match());
      this.#resetIndex();
      for (const quad of quads) this.#indexLiteral(quad.object);
    })();
    return this.#indexing;
  }

  /**
   * Adds a quad to the wrapped store, only possible when the wrapped store supports it.
   */
  add(quad: RDF.Quad): this {
    if (!this.#store.add) throw new Error("The wrapped store does not support adding quads");
    this.#store.add(quad);
    this.#indexLiteral(quad.object);
    return this;
  }

  /**
   * Deletes a quad from the wrapped store, only possible when the wrapped store supports it.
   */
  delete(quad: RDF.Quad): this {
    if (!this.#store.delete) throw new Error("The wrapped store does not support deleting quads");
    this.#store.delete(quad);
    // Without countQuads we can not tell if the literal is still used, keeping it in the index is harmless.
    if (
      quad.object.termType === "Literal" &&
      this.#store.countQuads?.(null, null, quad.object, null) === 0
    ) {
      const key = literalKey(quad.object);
      const id = this.#literalIds.get(key);
      if (id !== undefined) {
        this.#textIndex.remove(id);
        this.#literals.delete(id);
        this.#literalIds.delete(key);
      }
    }
    return this;
  }

  countQuads(...pattern: QuadPattern): number {
    const predicate = pattern[1];
    if (predicate && this.#searchTerm.equals(predicate)) return this.#literals.size || 1;
    return this.#store.countQuads?.(...pattern) ?? 1;
  }

  match(
    subject?: RDF.Term | null,
    predicate?: RDF.Term | null,
    object?: RDF.Term | null,
    graph?: RDF.Term | null,
  ): RDF.Stream<RDF.Quad> {
    const search = predicate?.equals(this.#searchTerm) ? object?.value : undefined;
    if (!search) return this.#store.match(subject, predicate, object, graph);

    const stream = new Readable({ objectMode: true, read() {} });

    (async () => {
      try {
        if (!this.#indexing) await this.reindex();
        await this.#indexing;

        const literalIds = this.#textIndex.search(search) as number[];
        for (const literalId of literalIds) {
          const literal = this.#literals.get(literalId);
          if (!literal) continue;
          const quads = await streamToArray(this.#store.match(subject, null, literal, graph));
          for (const quad of quads) stream.push(quad);
        }
        stream.push(null);
      } catch (error) {
        stream.destroy(error);
      }
    })();

    return stream;
  }

  #resetIndex() {
    this.#textIndex = new Index(this.#indexOptions);
    this.#literals.clear();
    this.#literalIds.clear();
  }

  #indexLiteral(term: RDF.Term) {
    if (term.termType !== "Literal") return;
    const key = literalKey(term);
    if (this.#literalIds.has(key)) return;
    const id = this.#nextLiteralId++;
    this.#literalIds.set(key, id);
    this.#literals.set(id, term);
    this.#textIndex.add(id, term.value);
  }
}
