import factory from "@rdfjs/data-model";
import type {
  DefaultGraph,
  NamedNode,
  Quad,
  Quad_Graph,
  Store as RdfJsStore,
  Source,
  Stream,
  Term,
} from "@rdfjs/types";
import EventEmitter from "events";
import Hex from "hex-encoding";
import { get, set } from "idb-keyval";
import { Parser, Store, Writer, type OTerm } from "n3";
/** @ts-expect-error readable-stream ships no type declarations */
import { Readable } from "readable-stream";
import { getAllFilesFromDirectory } from "./helpers/getAllFilesFromDirectory.ts";
import { getFileHandleByPath } from "./helpers/getFileHandleByPath.ts";
import { repairLangStrings } from "./helpers/langString.ts";
import { toTriple } from "./helpers/toTriple.ts";

type QuadTermName = "subject" | "predicate" | "object" | "graph";

/**
 * Only the graph is asked for, possibly for one given graph: the file names are enough to answer.
 */
const isListingGraphs = (termNames: QuadTermName[], filters: (Term | undefined)[]) =>
  termNames.length === 1 && termNames[0] === "graph" && !filters[0] && !filters[1] && !filters[2];

const termToKey = (term: Term): string =>
  term.termType === "Literal"
    ? `${term.termType}:${term.value}@${term.language}^${term.datatype.value}`
    : `${term.termType}:${term.value}`;

/**
 * Only keeps the prefixes whose namespace is used by one of the IRIs in the quads,
 * so that a file does not get declarations for every prefix the store has seen.
 */
const usedPrefixes = (prefixes: Record<string, string>, quads: Quad[]): Record<string, string> => {
  const iris = new Set<string>();
  for (const quad of quads) {
    for (const term of [quad.subject, quad.predicate, quad.object, quad.graph]) {
      if (term.termType === "NamedNode") iris.add(term.value);
      if (term.termType === "Literal") iris.add(term.datatype.value);
    }
  }
  return Object.fromEntries(
    Object.entries(prefixes).filter(
      ([, namespace]) => namespace && [...iris].some((iri) => iri.startsWith(namespace)),
    ),
  );
};

type LocalStoreOptions = {
  baseUri: URL;
};
/**
 * Creates a queryable store, that mounts a directory on the drive and read and writes turtle files.
 * Each of these files can have relative IRIs such as <> or <#lorem> or </ipsum>.
 */
export class LocalStore implements Source, RdfJsStore {
  public prefixes: Record<string, string> = {};
  #directoryHandle?: FileSystemDirectoryHandle;
  #baseUri: URL;
  #cache: Store = new Store();
  #inFlightCachePromises: Map<string, Promise<void>> = new Map();
  // Walking the folder is slow and Comunica asks for all graphs for every pattern without a graph.
  // Cleared whenever this store adds or removes a file, changes made outside of it are not seen.
  #graphsWithFileHandles?: Promise<[NamedNode | DefaultGraph, FileSystemFileHandle][]>;
  // The same list once it has been read, countDistinctTerms has to answer synchronously.
  #graphsWithFileHandlesRead?: [NamedNode | DefaultGraph, FileSystemFileHandle][];
  #graphsVersion = 0;

  /**
   * Tells Comunica that this store can answer SELECT DISTINCT queries over one pattern itself,
   * see matchDistinctTerms. Listing the graphs is then done without parsing any file.
   */
  features = { indexDistinctTerms: true };

  constructor({ baseUri }: LocalStoreOptions) {
    this.#baseUri = baseUri;
    if (!baseUri.toString().endsWith("/")) throw new Error("BaseIRI must end on a trailing slash");
  }

  /**
   * Connects to a previously mounted folder when given its name,
   * or show a directory picker to connect to a folder.
   */
  async mount(name?: string) {
    try {
      const mounts: Set<string> = (await get("mounts")) ?? new Set();

      if (name && mounts.has(name)) {
        this.#directoryHandle = await get(name);
        this.#forgetGraphs();
        this.#listGraphs().catch(() => this.#forgetGraphs());
        return;
      }

      if (name && !mounts.has(name)) {
        console.info(`Could not find connection to folder ${name}, please connect again.`);
      }

      this.#directoryHandle = await globalThis.showDirectoryPicker({ mode: "readwrite" });
      this.#forgetGraphs();
      if (!this.#directoryHandle) throw new Error("Could not save the folder");
      await set(name ?? this.#directoryHandle.name, this.#directoryHandle);
      mounts.add(name ?? this.#directoryHandle.name);
      set("mounts", mounts);
      this.#listGraphs().catch(() => this.#forgetGraphs());
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Deletes a connection to a folder.
   * This does not delete the folder on disk, but only the connection to it.
   */
  async unmount(name: string) {
    try {
      if (this.#directoryHandle) {
        this.#directoryHandle = undefined;
        this.#forgetGraphs();
        const mounts: Set<string> = (await get("mounts")) ?? new Set();
        mounts.delete(name);
        set("mounts", mounts);
      }
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Returns the name of the currently mounted folder.
   */
  getFolderName(): string | undefined {
    return this.#directoryHandle?.name;
  }

  /**
   * Only use this when there is no data yet in the local folder attached to the previous baseURI.
   * Currently this does not rename previous data, it orphans it.
   */
  setBaseUri(baseUri: URL): void {
    if (!baseUri.toString().endsWith("/")) throw new Error("BaseURI must end on a trailing slash");
    this.#baseUri = baseUri;
    this.#forgetGraphs();
  }

  /**
   * Removes quads by matching
   */
  removeMatches(
    subject?: Term | null,
    predicate?: Term | null,
    object?: Term | null,
    graph?: Term | null,
  ): EventEmitter {
    const eventEmitter = new EventEmitter();
    let graphIterations = 0;
    let graphIterationsEnded = 0;

    (async () => {
      const graphIterator = graph ? ([graph] as [NamedNode]) : this.getNamedGraphs();

      for await (const graph of graphIterator) {
        graphIterations++;
        /** @ts-expect-error the typings are off */
        this.#cache.removeMatches(subject, predicate, object, graph);
        const matches = this.match(subject, predicate, object, graph);
        const deletions: Quad[] = [];

        matches.on("data", (quad) => deletions.push(quad));
        matches.on("end", () => {
          this.updateGraph(graph, { deletions });

          graphIterationsEnded++;
          if (graphIterations === graphIterationsEnded) {
            eventEmitter.emit("end");
          }
        });
      }
    })();

    return eventEmitter;
  }

  /**
   * Deletes one graph, triggered by DROP GRAPH <a>
   */
  deleteGraph(graph: string | Quad_Graph): EventEmitter {
    const eventEmitter = new EventEmitter();
    const graphTerm = (typeof graph === "string" ? factory.namedNode(graph) : graph) as NamedNode;
    this.#cache.deleteGraph(graph);
    this.#forgetGraphs();
    this.#graphToFileHandle(graphTerm).then(async (fileHandle) => {
      /** @ts-expect-error Somehow the typings are off. Chrome really has this method */
      fileHandle?.remove();
      eventEmitter.emit("end");
    });

    return eventEmitter;
  }

  /**
   * Imports quads to one or multiple disk files.
   */
  import(stream: Stream<Quad>): EventEmitter {
    const eventEmitter = new EventEmitter();
    let lastGraph: NamedNode | DefaultGraph | undefined = undefined;
    const insertions: Record<string, Quad[]> = {};

    const onEvent = (quad?: Quad) => {
      if (lastGraph && (!quad || !quad.graph.equals(lastGraph))) {
        this.updateGraph(lastGraph, { insertions: insertions[lastGraph.value] });
      }

      if (quad) {
        if (!(quad.graph.value in insertions)) insertions[quad.graph.value] = [];
        insertions[quad.graph.value].push(quad);
        lastGraph = quad.graph as DefaultGraph | NamedNode<string>;
      } else {
        lastGraph = undefined;
        eventEmitter.emit("end");
      }
    };

    stream.on("data", onEvent);
    stream.on("end", onEvent);

    stream.on("error", (error: Error) => {
      console.error("Error in input stream:", error);
      eventEmitter.emit("error", error);
    });

    return eventEmitter;
  }

  /**
   * Removes quads from one or multiple disk files.
   */
  remove(stream: Stream<Quad>): EventEmitter {
    const eventEmitter = new EventEmitter();
    let lastGraph: NamedNode | DefaultGraph | undefined = undefined;
    const deletions: Record<string, Quad[]> = {};

    const onEvent = (quad?: Quad) => {
      if (lastGraph && (!quad || !quad.graph.equals(lastGraph))) {
        this.updateGraph(lastGraph, { deletions: deletions[lastGraph.value] });
      }

      if (quad) {
        if (!(quad.graph.value in deletions)) deletions[quad.graph.value] = [];
        deletions[quad.graph.value].push(quad);
        lastGraph = quad.graph as DefaultGraph | NamedNode<string>;
      } else {
        lastGraph = undefined;
        eventEmitter.emit("end");
      }
    };

    stream.on("data", onEvent);
    stream.on("end", onEvent);
    stream.on("error", (error: Error) => {
      console.error("Error in input stream:", error);
      eventEmitter.emit("error", error);
    });

    return eventEmitter;
  }

  /**
   * Updates one graph on disk
   */
  async updateGraph(
    graph: NamedNode | DefaultGraph,
    update: { deletions?: Quad[]; insertions?: Quad[]; prefixes?: Record<string, string> },
  ): Promise<void> {
    const fileHandle = (await this.#graphToFileHandle(graph, true)) as FileSystemFileHandle;
    const file = await fileHandle.getFile()!;

    const contents = await file.text();
    const parser = new Parser({ baseIRI: graph.value });
    const quads = parser.parse(repairLangStrings(contents));
    /** @ts-expect-error an internal property of the parser */
    const filePrefixes: Record<string, string> = parser._prefixes;

    const existingQuads = new Store(quads);
    const quadsToDelete = new Store(update.deletions?.map(toTriple));
    const quadsToAdd = new Store(update.insertions?.map(toTriple));

    const mutatedQuads = existingQuads.difference(quadsToDelete).union(quadsToAdd);
    return this.#writeGraph(graph, fileHandle, [...mutatedQuads], {
      ...filePrefixes,
      ...update.prefixes,
    });
  }

  /**
   * Replaces the contents of one graph on disk with the given quads.
   * Useful for blank nodes, those can not be matched for deletion between two parses of the same file.
   * The prefixes of the file that is replaced are kept, given prefixes win over those.
   */
  async replaceGraph(
    graph: NamedNode | DefaultGraph,
    quads: Quad[],
    prefixes?: Record<string, string>,
  ): Promise<void> {
    const fileHandle = (await this.#graphToFileHandle(graph, true)) as FileSystemFileHandle;
    const filePrefixes = await this.#readPrefixes(graph, fileHandle);
    return this.#writeGraph(graph, fileHandle, quads.map(toTriple), {
      ...filePrefixes,
      ...prefixes,
    });
  }

  /**
   * The prefixes declared in a file on disk, empty when the file is new or can not be parsed.
   */
  async #readPrefixes(
    graph: NamedNode | DefaultGraph,
    fileHandle: FileSystemFileHandle,
  ): Promise<Record<string, string>> {
    try {
      const contents = await (await fileHandle.getFile()).text();
      if (!contents.trim()) return {};
      const parser = new Parser({ baseIRI: graph.value });
      parser.parse(repairLangStrings(contents));
      /** @ts-expect-error an internal property of the parser */
      return parser._prefixes;
    } catch {
      return {};
    }
  }

  /**
   * Writes the quads as Turtle. All prefixes this store knows of (from files it has read and given ones)
   * are candidates, only the ones that are used by the quads end up in the file.
   */
  async #writeGraph(
    graph: NamedNode | DefaultGraph,
    fileHandle: FileSystemFileHandle,
    quads: Quad[],
    prefixes: Record<string, string> = {},
  ) {
    this.prefixes = { ...this.prefixes, ...prefixes };
    const writer = new Writer({
      baseIRI: graph.value,
      prefixes: usedPrefixes({ ...this.prefixes, ...prefixes }, quads),
    });
    writer.addQuads(quads);

    const result = await new Promise<string>((resolve, reject) => {
      writer.end((error: Error, result: string) => (error ? reject(error) : resolve(result)));
    });

    const writable = await fileHandle.createWritable();
    await writable.write(result);
    await writable.close();

    // Clear the cache so fresh data wil be fetched, the file may also be new.
    this.#cache.deleteGraph(graph);
    this.#inFlightCachePromises.delete(graph.value);
    this.#forgetGraphs();
  }

  /**
   * An optimization for Comunica, so that there are less .match() calls.
   */
  countQuads(
    subject?: Term | null,
    predicate?: Term | null,
    object?: Term | null,
    graph?: Term | null,
  ): number {
    if (graph && this.#graphIsCached(graph as NamedNode | DefaultGraph))
      return this.#cache.countQuads(subject as OTerm, predicate as OTerm, object as OTerm, graph);
    return 1;
  }

  /**
   * The main function for local store for reading.
   * When a match is done we decide which graphs we need to cache and parse them and put them in the N3 store.
   */
  match(
    subject?: Term | null,
    predicate?: Term | null,
    object?: Term | null,
    graph?: Term | null,
  ): Stream<Quad> {
    if (!this.#directoryHandle) throw new Error(`Local store not mounted`);
    const stream = new Readable({ objectMode: true });
    let isReading = false;
    let hasEnded = false;
    let startedAllStreams = false;

    stream._read = async () => {
      if (isReading || hasEnded) return;
      isReading = true;

      try {
        const graphIterator = this.getNamedGraphs(graph ? [graph as NamedNode] : undefined);

        let graphIterations = 0;
        let graphIterationsEnded = 0;

        for await (const graph of graphIterator) {
          if (hasEnded) return;
          graphIterations++;
          if (!this.#graphIsCached(graph)) await this.#cacheGraph(graph);
          const graphStream = this.#cache.match(
            /** @ts-expect-error the N3 Store#match typings don't accept nullable term filters here */
            subject,
            predicate,
            object,
            graph,
          );

          graphStream.on("data", (quad: Quad) => {
            if (stream.destroyed || hasEnded) return;
            stream.push(quad);
          });

          graphStream.on("end", () => {
            graphIterationsEnded++;
            if (graphIterations === graphIterationsEnded && !hasEnded && startedAllStreams) {
              hasEnded = true;
              stream.push(null);
            }
          });
        }

        startedAllStreams = true;

        if (!hasEnded && startedAllStreams && graphIterations === graphIterationsEnded) {
          hasEnded = true;
          stream.push(null);
        }
      } catch (error) {
        if (!hasEnded) {
          hasEnded = true;
          stream.destroy(error as Error);
        }
      }
    };

    return stream;
  }

  /**
   * Check in the N3 store if the graph is cached.
   */
  #graphIsCached(graph: NamedNode | DefaultGraph) {
    /** @ts-expect-error we are using N3s internal API */
    return this.#cache._graphs[this.#cache._termToNumericId(graph)] !== undefined;
  }

  /**
   * Cache a graph, it can be the case that a graph on disk is parsed and that this takes a while and in the same time a request is done for the same graph.
   * For this reason we deduplicate the in flight promises.
   */
  async #cacheGraph(graph: NamedNode | DefaultGraph) {
    const fileHandle = await this.#graphToFileHandle(graph as NamedNode | DefaultGraph);
    if (!fileHandle) return;

    if (!this.#inFlightCachePromises.has(graph.value)) {
      const promise = this.#parseAndStoreGraph(graph, fileHandle);
      this.#inFlightCachePromises.set(graph.value, promise);
    }

    return this.#inFlightCachePromises.get(graph.value);
  }

  /**
   * The actual function that parses a file on disk and puts it into the N3 store.
   */
  async #parseAndStoreGraph(graph: NamedNode | DefaultGraph, fileHandle: FileSystemFileHandle) {
    try {
      const parser = new Parser({ baseIRI: graph.value });
      const contents = await (await fileHandle.getFile()).text();
      const strippedContents = repairLangStrings(
        contents.replace(/<(.|\/)(.*)\.ttl(.*)>/g, "<$1$2>"),
      );
      const quads = await parser.parse(strippedContents);
      /** @ts-expect-error an internal property of the parser */
      const prefixes = parser._prefixes;
      this.prefixes = { ...this.prefixes, ...prefixes };
      this.#cache.addQuads(
        quads.map((quad) => factory.quad(quad.subject, quad.predicate, quad.object, graph)),
      );
    } catch (error) {
      throw new Error(
        `Error while parsing graph ${graph.value}:` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /**
   * Returns all named graphs or a subset of them.
   */
  async *getNamedGraphs(
    graphs?: (NamedNode | DefaultGraph)[],
  ): AsyncIterable<NamedNode | DefaultGraph> {
    if (graphs && graphs.length > 0) {
      for (const graph of graphs) {
        const fileHandle = await this.#graphToFileHandle(graph, false);
        if (fileHandle) {
          yield graph;
        }
      }
      return;
    }

    for await (const [graph] of this.#getNamedGraphsWithFileHandle()) {
      yield graph;
    }
  }

  async *#getNamedGraphsWithFileHandle(): AsyncIterable<
    [NamedNode | DefaultGraph, FileSystemFileHandle]
  > {
    yield* await this.#listGraphs();
  }

  /**
   * Walks the folder once, the result is kept until this store adds or removes a file.
   */
  #listGraphs(): Promise<[NamedNode | DefaultGraph, FileSystemFileHandle][]> {
    if (!this.#directoryHandle) throw new Error(`Local store not mounted`);
    const directoryHandle = this.#directoryHandle;

    if (!this.#graphsWithFileHandles) {
      const version = this.#graphsVersion;
      this.#graphsWithFileHandles = (async () => {
        const graphsWithFileHandles: [NamedNode | DefaultGraph, FileSystemFileHandle][] = [];
        for await (const [path, entry] of getAllFilesFromDirectory(directoryHandle)) {
          graphsWithFileHandles.push([this.#pathAndFileHandleToGraph(path), entry]);
        }
        // Only keep the result when no file was added or removed in the meantime.
        if (version === this.#graphsVersion)
          this.#graphsWithFileHandlesRead = graphsWithFileHandles;
        return graphsWithFileHandles;
      })();
    }

    return this.#graphsWithFileHandles;
  }

  #forgetGraphs() {
    this.#graphsVersion++;
    this.#graphsWithFileHandles = undefined;
    this.#graphsWithFileHandlesRead = undefined;
  }

  /**
   * Returns a stream of the distinct combinations of the given terms, used by Comunica for SELECT DISTINCT
   * queries over one pattern. Listing the graphs is answered from the file names without parsing them,
   * everything else is read from the parsed files.
   *
   * A requested graph follows SPARQL's GRAPH ?g, so the default graph is not part of the results.
   *
   * @param termNames The terms to return, in this order.
   * @param filters Terms that the quads must have, in the order subject, predicate, object, graph.
   */
  matchDistinctTerms(termNames: QuadTermName[], filters: (Term | undefined)[] = []): EventEmitter {
    const stream = new Readable({ objectMode: true, read() {} });

    (async () => {
      try {
        for await (const terms of this.#distinctTerms(termNames, filters)) stream.push(terms);
        stream.push(null);
      } catch (error) {
        stream.destroy(error as Error);
      }
    })();

    return stream;
  }

  /**
   * Returns the number of distinct combinations of the given terms.
   * Comunica asks for this synchronously, so it is exact for listing the graphs once the folder has been read
   * and otherwise an estimate based on the files parsed so far.
   */
  countDistinctTerms(termNames: QuadTermName[], filters: (Term | undefined)[] = []): number {
    const [subject, predicate, object, graph] = filters;

    if (isListingGraphs(termNames, filters)) {
      if (graph) return 1;
      if (this.#graphsWithFileHandlesRead) {
        return this.#graphsWithFileHandlesRead.filter(
          ([graph]) => graph.termType !== "DefaultGraph",
        ).length;
      }
    }

    /** @ts-expect-error the N3 Store#countQuads typings don't accept undefined term filters */
    return Math.max(this.#cache.countQuads(subject, predicate, object, graph), 1);
  }

  async *#distinctTerms(
    termNames: QuadTermName[],
    filters: (Term | undefined)[],
  ): AsyncIterable<Term[]> {
    const [subject, predicate, object, graph] = filters;

    if (isListingGraphs(termNames, filters)) {
      for await (const namedGraph of this.getNamedGraphs(
        graph ? [graph as NamedNode] : undefined,
      )) {
        if (namedGraph.termType !== "DefaultGraph") yield [namedGraph];
      }
      return;
    }

    const seen = new Set<string>();
    // The readable-stream from match is async iterable, the RDF/JS Stream type just does not say so.
    const quads = this.match(subject, predicate, object, graph) as unknown as AsyncIterable<Quad>;
    for await (const quad of quads) {
      if (termNames.includes("graph") && quad.graph.termType === "DefaultGraph") continue;
      const terms = termNames.map((termName) => quad[termName]);
      const key = terms.map(termToKey).join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      yield terms;
    }
  }

  /**
   * Given a path and a file handle, creates a graph term.
   */
  #pathAndFileHandleToGraph(path: string): NamedNode | DefaultGraph {
    const cleanedPath = path.substring(0, path.length - 4);
    const parts = cleanedPath.split("/");
    const filename = parts.pop()!;

    /**
     * The default graph, the folder walk gives paths starting with ./
     */
    if (path.replace(/^\.\//, "") === "default-graph.ttl") return factory.defaultGraph();

    /**
     * A graph that is not starting with our base name.
     */
    if (Hex.is(filename)) {
      const decoded = Hex.decodeStr(filename);
      return factory.namedNode(decoded);
    }

    /**
     * Relative named graphs
     */
    return factory.namedNode(new URL(cleanedPath, this.#baseUri).toString());
  }

  /**
   * Given a graph term returns the file handle from disk.
   */
  async #graphToFileHandle(
    graph: NamedNode | DefaultGraph,
    create?: boolean,
  ): Promise<FileSystemFileHandle | undefined> {
    if (!this.#directoryHandle) throw new Error(`Local store not mounted`);

    /**
     * Relative named graphs
     */
    if (graph.value.startsWith(this.#baseUri.toString())) {
      const relativeGraph = graph.value.replace(this.#baseUri.toString(), "");
      const cleanedRelativeGraph = relativeGraph.endsWith("/")
        ? relativeGraph.substring(0, relativeGraph.length - 1)
        : relativeGraph;
      const filename = `${cleanedRelativeGraph}.ttl`;

      if (!cleanedRelativeGraph) throw new Error("A graph must have a filename");

      try {
        return getFileHandleByPath(filename, this.#directoryHandle, create);
      } catch {}

      /**
       * The default graph
       */
    } else if (graph.termType === "DefaultGraph") {
      return getFileHandleByPath("default-graph.ttl", this.#directoryHandle, create);

      /**
       * A graph that is not starting with our base name.
       */
    } else {
      const uint8 = new TextEncoder().encode(graph.value);
      const encoded = Hex.encode(uint8);
      const filename = `${encoded}.ttl`;
      return getFileHandleByPath(filename, this.#directoryHandle, create);
    }
  }
}
