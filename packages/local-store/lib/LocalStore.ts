import factory from '@rdfjs/data-model'
import type { DefaultGraph, NamedNode, Quad, Quad_Graph, Store as RdfJsStore, Source, Stream, Term } from '@rdfjs/types'
import EventEmitter from 'events'
import Hex from 'hex-encoding'
import { get, set } from 'idb-keyval'
import { Parser, Store, Writer, type OTerm } from 'n3'
/** @ts-expect-error readable-stream ships no type declarations */
import { Readable } from 'readable-stream'
import { getAllFilesFromDirectory } from './helpers/getAllFilesFromDirectory.ts'
import { getFileHandleByPath } from './helpers/getFileHandleByPath.ts'
import { toTriple } from './helpers/toTriple.ts'

type LocalStoreOptions = {
  baseUri: URL
}
/**
 * Creates a queryable store, that mounts a directory on the drive and read and writes turtle files.
 * Each of these files can have relative IRIs such as <> or <#lorem> or </ipsum>.
 */
export class LocalStore implements Source, RdfJsStore {
  public prefixes: Record<string, string> = {}
  #directoryHandle?: FileSystemDirectoryHandle
  #baseUri: URL
  #cache: Store = new Store()
  #inFlightCachePromises: Map<string, Promise<void>> = new Map()

  constructor({ baseUri }: LocalStoreOptions) {
    this.#baseUri = baseUri
    if (!baseUri.toString().endsWith('/')) throw new Error('BaseIRI must end on a trailing slash')
  }

  /**
   * Connects to a previously mounted folder when given its name,
   * or show a directory picker to connect to a folder.
   */
  async mount(name?: string) {
    try {
      const mounts: Set<string> = (await get('mounts')) ?? new Set()

      if (name && mounts.has(name)) {
        this.#directoryHandle = await get(name)
        return
      }

      if (name && !mounts.has(name)) {
        console.info(`Could not find connection to folder ${name}, please connect again.`)
      }

      this.#directoryHandle = await globalThis.showDirectoryPicker()
      if (!this.#directoryHandle) throw new Error('Could not save the folder')
      await set(name ?? this.#directoryHandle.name, this.#directoryHandle)
      mounts.add(name ?? this.#directoryHandle.name)
      set('mounts', mounts)
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Deletes a connection to a folder.
   * This does not delete the folder on disk, but only the connection to it.
   */
  async unmount(name: string) {
    try {
      if (this.#directoryHandle) {
        this.#directoryHandle = undefined
        const mounts: Set<string> = (await get('mounts')) ?? new Set()
        mounts.delete(name)
        set('mounts', mounts)
      }
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Returns the name of the currently mounted folder.
   */
  getFolderName(): string | undefined {
    return this.#directoryHandle?.name
  }

  /**
   * Only use this when there is no data yet in the local folder attached to the previous baseURI.
   * Currently this does not rename previous data, it orphans it.
   */
  setBaseUri(baseUri: URL): void {
    if (!baseUri.toString().endsWith('/')) throw new Error('BaseURI must end on a trailing slash')
    this.#baseUri = baseUri
  }

  /**
   * Removes quads by matching
   */
  removeMatches(
    subject?: Term | null,
    predicate?: Term | null,
    object?: Term | null,
    graph?: Term | null
  ): EventEmitter {
    const eventEmitter = new EventEmitter()
    let graphIterations = 0
    let graphIterationsEnded = 0

    ;(async () => {
      const graphIterator = graph ? ([graph] as [NamedNode]) : this.getNamedGraphs()

      for await (const graph of graphIterator) {
        graphIterations++
        /** @ts-expect-error the typings are off */
        this.#cache.removeMatches(subject, predicate, object, graph)
        const matches = this.match(subject, predicate, object, graph)
        const deletions: Quad[] = []

        matches.on('data', quad => deletions.push(quad))
        matches.on('end', () => {
          this.updateGraph(graph, { deletions })

          graphIterationsEnded++
          if (graphIterations === graphIterationsEnded) {
            eventEmitter.emit('end')
          }
        })
      }
    })()

    return eventEmitter
  }

  /**
   * Deletes one graph, triggered by DROP GRAPH <a>
   */
  deleteGraph(graph: string | Quad_Graph): EventEmitter {
    const eventEmitter = new EventEmitter()
    const graphTerm = (typeof graph === 'string' ? factory.namedNode(graph) : graph) as NamedNode
    this.#cache.deleteGraph(graph)
    this.#graphToFileHandle(graphTerm).then(async fileHandle => {
      /** @ts-expect-error Somehow the typings are off. Chrome really has this method */
      fileHandle?.remove()
      eventEmitter.emit('end')
    })

    return eventEmitter
  }

  /**
   * Imports quads to one or multiple disk files.
   */
  import(stream: Stream<Quad>): EventEmitter {
    const eventEmitter = new EventEmitter()
    let lastGraph: NamedNode | DefaultGraph | undefined = undefined
    const insertions: Record<string, Quad[]> = {}

    const onEvent = (quad?: Quad) => {
      if (lastGraph && (!quad || !quad.graph.equals(lastGraph))) {
        this.updateGraph(lastGraph, { insertions: insertions[lastGraph.value] })
      }

      if (quad) {
        if (!(quad.graph.value in insertions)) insertions[quad.graph.value] = []
        insertions[quad.graph.value].push(quad)
        lastGraph = quad.graph as DefaultGraph | NamedNode<string>
      } else {
        lastGraph = undefined
        eventEmitter.emit('end')
      }
    }

    stream.on('data', onEvent)
    stream.on('end', onEvent)

    stream.on('error', (error: Error) => {
      console.error('Error in input stream:', error)
      eventEmitter.emit('error', error)
    })

    return eventEmitter
  }

  /**
   * Removes quads from one or multiple disk files.
   */
  remove(stream: Stream<Quad>): EventEmitter {
    const eventEmitter = new EventEmitter()
    let lastGraph: NamedNode | DefaultGraph | undefined = undefined
    const deletions: Record<string, Quad[]> = {}

    const onEvent = (quad?: Quad) => {
      if (lastGraph && (!quad || !quad.graph.equals(lastGraph))) {
        this.updateGraph(lastGraph, { deletions: deletions[lastGraph.value] })
      }

      if (quad) {
        if (!(quad.graph.value in deletions)) deletions[quad.graph.value] = []
        deletions[quad.graph.value].push(quad)
        lastGraph = quad.graph as DefaultGraph | NamedNode<string>
      } else {
        lastGraph = undefined
        eventEmitter.emit('end')
      }
    }

    stream.on('data', onEvent)
    stream.on('end', onEvent)
    stream.on('error', (error: Error) => {
      console.error('Error in input stream:', error)
      eventEmitter.emit('error', error)
    })

    return eventEmitter
  }

  /**
   * Updates one graph on disk
   */
  async updateGraph(
    graph: NamedNode | DefaultGraph,
    update: { deletions?: Quad[]; insertions?: Quad[] }
  ): Promise<void> {
    const fileHandle = (await this.#graphToFileHandle(graph, true)) as FileSystemFileHandle
    const file = await fileHandle.getFile()!

    const contents = await file.text()
    const parser = new Parser({ baseIRI: graph.value })
    const quads = parser.parse(contents)

    const existingQuads = new Store(quads)
    const quadsToDelete = new Store(update.deletions?.map(toTriple))
    const quadsToAdd = new Store(update.insertions?.map(toTriple))

    const mutatedQuads = existingQuads.difference(quadsToDelete).union(quadsToAdd)
    const writer = new Writer({ baseIRI: graph.value })
    writer.addQuads([...mutatedQuads])

    return new Promise((resolve, reject) => {
      writer.end(async (error: Error, result: string) => {
        const writable = await fileHandle.createWritable()
        await writable.write(result)
        await writable.close()

        // Clear the cache so fresh data wil be fetched.
        this.#cache.deleteGraph(graph)
        this.#inFlightCachePromises.delete(graph.value)

        if (error) reject(error)
        resolve(undefined)
      })
    })
  }

  /**
   * An optimization for Comunica, so that there are less .match() calls.
   */
  countQuads(subject?: Term | null, predicate?: Term | null, object?: Term | null, graph?: Term | null): number {
    if (graph && this.#graphIsCached(graph as NamedNode | DefaultGraph))
      return this.#cache.countQuads(subject as OTerm, predicate as OTerm, object as OTerm, graph)
    return 1
  }

  /**
   * The main function for local store for reading.
   * When a match is done we decide which graphs we need to cache and parse them and put them in the N3 store.
   */
  match(subject?: Term | null, predicate?: Term | null, object?: Term | null, graph?: Term | null): Stream<Quad> {
    if (!this.#directoryHandle) throw new Error(`Local store not mounted`)
    const stream = new Readable({ objectMode: true })
    let isReading = false
    let hasEnded = false
    let startedAllStreams = false

    stream._read = async () => {
      if (isReading || hasEnded) return
      isReading = true

      try {
        const graphIterator = this.getNamedGraphs(graph ? [graph as NamedNode] : undefined)

        let graphIterations = 0
        let graphIterationsEnded = 0

        for await (const graph of graphIterator) {
          if (hasEnded) return
          graphIterations++
          if (!this.#graphIsCached(graph)) await this.#cacheGraph(graph)
          const graphStream = this.#cache.match(
            /** @ts-expect-error the N3 Store#match typings don't accept nullable term filters here */
            subject,
            predicate,
            object,
            graph
          )

          graphStream.on('data', (quad: Quad) => {
            if (stream.destroyed || hasEnded) return
            stream.push(quad)
          })

          graphStream.on('end', () => {
            graphIterationsEnded++
            if (graphIterations === graphIterationsEnded && !hasEnded && startedAllStreams) {
              hasEnded = true
              stream.push(null)
            }
          })
        }

        startedAllStreams = true

        if (!hasEnded && startedAllStreams && graphIterations === graphIterationsEnded) {
          hasEnded = true
          stream.push(null)
        }
      } catch (error) {
        if (!hasEnded) {
          hasEnded = true
          stream.destroy(error as Error)
        }
      }
    }

    return stream
  }

  /**
   * Check in the N3 store if the graph is cached.
   */
  #graphIsCached(graph: NamedNode | DefaultGraph) {
    /** @ts-expect-error we are using N3s internal API */
    return this.#cache._graphs[this.#cache._termToNumericId(graph)] !== undefined
  }

  /**
   * Cache a graph, it can be the case that a graph on disk is parsed and that this takes a while and in the same time a request is done for the same graph.
   * For this reason we deduplicate the in flight promises.
   */
  async #cacheGraph(graph: NamedNode | DefaultGraph) {
    const fileHandle = await this.#graphToFileHandle(graph as NamedNode | DefaultGraph)
    if (!fileHandle) return

    if (!this.#inFlightCachePromises.has(graph.value)) {
      const promise = this.#parseAndStoreGraph(graph, fileHandle)
      this.#inFlightCachePromises.set(graph.value, promise)
    }

    return this.#inFlightCachePromises.get(graph.value)
  }

  /**
   * The actual function that parses a file on disk and puts it into the N3 store.
   */
  async #parseAndStoreGraph(graph: NamedNode | DefaultGraph, fileHandle: FileSystemFileHandle) {
    try {
      const parser = new Parser({ baseIRI: graph.value })
      const contents = await (await fileHandle.getFile()).text()
      const strippedContents = contents.replace(/<(.|\/)(.*)\.ttl(.*)>/g, '<$1$2>')
      const quads = await parser.parse(strippedContents)
      /** @ts-expect-error an internal property of the parser */
      const prefixes = parser._prefixes
      this.prefixes = { ...this.prefixes, ...prefixes }
      this.#cache.addQuads(quads.map(quad => factory.quad(quad.subject, quad.predicate, quad.object, graph)))
    } catch (error) {
      throw new Error(`Error while parsing graph ${graph.value}:` + (error instanceof Error ? error.message : String(error)))
    }
  }

  /**
   * Returns all named graphs or a subset of them.
   */
  async *getNamedGraphs(graphs?: (NamedNode | DefaultGraph)[]): AsyncIterable<NamedNode | DefaultGraph> {
    if (graphs && graphs.length > 0) {
      for (const graph of graphs) {
        const fileHandle = await this.#graphToFileHandle(graph, false)
        if (fileHandle) {
          yield graph
        }
      }
      return
    }

    for await (const [graph] of this.#getNamedGraphsWithFileHandle()) {
      yield graph
    }
  }

  async *#getNamedGraphsWithFileHandle(): AsyncIterable<[NamedNode | DefaultGraph, FileSystemFileHandle]> {
    if (!this.#directoryHandle) throw new Error(`Local store not mounted`)

    for await (const [path, entry] of getAllFilesFromDirectory(this.#directoryHandle)) {
      const graph = this.#pathAndFileHandleToGraph(path)
      yield [graph, entry]
    }
  }

  /**
   * Given a path and a file handle, creates a graph term.
   */
  #pathAndFileHandleToGraph(path: string): NamedNode | DefaultGraph {
    const cleanedPath = path.substring(0, path.length - 4)
    const parts = cleanedPath.split('/')
    const filename = parts.pop()!

    /**
     * The default graph
     */
    if (path === 'default-graph.ttl') return factory.defaultGraph()

    /**
     * A graph that is not starting with our base name.
     */
    if (Hex.is(filename)) {
      const decoded = Hex.decodeStr(filename)
      return factory.namedNode(decoded)
    }

    /**
     * Relative named graphs
     */
    return factory.namedNode(new URL(cleanedPath, this.#baseUri).toString())
  }

  /**
   * Given a graph term returns the file handle from disk.
   */
  async #graphToFileHandle(
    graph: NamedNode | DefaultGraph,
    create?: boolean
  ): Promise<FileSystemFileHandle | undefined> {
    if (!this.#directoryHandle) throw new Error(`Local store not mounted`)

    /**
     * Relative named graphs
     */
    if (graph.value.startsWith(this.#baseUri.toString())) {
      const relativeGraph = graph.value.replace(this.#baseUri.toString(), '')
      const cleanedRelativeGraph = relativeGraph.endsWith('/')
        ? relativeGraph.substring(0, relativeGraph.length - 1)
        : relativeGraph
      const filename = `${cleanedRelativeGraph}.ttl`

      if (!cleanedRelativeGraph) throw new Error('A graph must have a filename')

      try {
        return getFileHandleByPath(filename, this.#directoryHandle, create)
      } catch {}

      /**
       * The default graph
       */
    } else if (graph.termType === 'DefaultGraph') {
      return getFileHandleByPath('default-graph.ttl', this.#directoryHandle, create)

      /**
       * A graph that is not starting with our base name.
       */
    } else {
      const uint8 = new TextEncoder().encode(graph.value)
      const encoded = Hex.encode(uint8)
      const filename = `${encoded}.ttl`
      return getFileHandleByPath(filename, this.#directoryHandle, create)
    }
  }
}
