import "@/polyfills/ensureProcess.ts";
import "@/polyfills/ensureBuffer.ts";
import { glob, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { NamedNode, Quad, Stream } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { rdfParser } from "rdf-parse";
import { RdfStore } from "rdf-stores";
import stringToStream from "string-to-stream";
import { generate } from "ts-to-zod";
import { resolveFocusNodeAndNodeShapePairs } from "@/resolution/focusNodeAndNodeShapeResolution.ts";
import type { LanguageRange } from "@/types/BCP47.ts";
import { rdfToJs } from "@/outputs/rdf-to-js.ts";
import { shaclToType } from "@/outputs/shacl-to-type.ts";

export interface AstroLoaderOptions {
  // A path or glob (relative to the Astro project root) to the shapes file(s).
  shapes: string | string[];
  // A path or glob (relative to the Astro project root) to the data. Shapes may be included but do
  // not need to be.
  data: string | string[];
  // Only load the targets of these node shapes. Defaults to the targets of every node shape.
  nodeShapes?: string[];
  // Ranked language preference used to collapse rdf:langString values to one string, see
  // rdfToJs's own `languages` option.
  languages?: LanguageRange[];
  // When given, a zod schema for the loaded entries (generated from shaclToType's types via
  // ts-to-zod, importing z from astro:content) is written to this file, relative to the Astro
  // project root - one `${codeIdentifier}Schema` export per node shape.
  schemaFile?: string;
}

// The subset of Astro's LoaderContext this loader uses - declared structurally so this package
// needs no dependency on astro itself; a function of this type is assignable to astro's Loader.
interface AstroLoaderContext {
  config: { root: URL };
  store: {
    clear(): void;
    set(entry: { id: string; data: Record<string, unknown>; digest?: string }): boolean;
  };
  generateDigest(data: Record<string, unknown> | string): string;
}

/**
 * An Astro content loader (`defineCollection({ loader: astroLoader({...}) })`): one entry per
 * (focus node, node shape) pair resolved from the given shapes and data, keyed by the focus node's
 * IRI and read into plain JS via rdfToJs, so each entry is shaped like shaclToType's generated type.
 */
export function astroLoader(options: AstroLoaderOptions): {
  name: string;
  load: (context: AstroLoaderContext) => Promise<void>;
} {
  return {
    name: "@shapething/shacl-renderer",
    load: async ({ config, store, generateDigest }) => {
      const root = fileURLToPath(config.root);
      const [shapesGraph, dataGraph] = await Promise.all([
        parseFiles(root, options.shapes),
        parseFiles(root, options.data),
      ]);
      const nodeShapes = options.nodeShapes?.map((iri) => factory.namedNode(iri));

      const pairs = resolveFocusNodeAndNodeShapePairs({ shapesGraph, dataGraph }).filter(
        (pair) => !nodeShapes || nodeShapes.some((shape) => shape.equals(pair.nodeShape)),
      );

      store.clear();
      for (const { focusNode, nodeShape } of pairs) {
        const data = await rdfToJs({
          shapesGraph,
          dataGraph,
          focusNode,
          nodeShapes: [nodeShape],
          languages: options.languages,
        });
        store.set({ id: focusNode.value, data, digest: generateDigest(data) });
      }

      if (options.schemaFile) {
        const schemaFile = path.resolve(root, options.schemaFile);
        const types = shaclToType({
          shapesGraph,
          nodeShapes: nodeShapes ?? uniqueNamedShapes(pairs.map((pair) => pair.nodeShape)),
        });
        await mkdir(path.dirname(schemaFile), { recursive: true });
        await writeFile(schemaFile, zodSchemaFile([...types.values()].join("\n")));
      }
    },
  };
}

const factory = new DataFactory();

const uniqueNamedShapes = (shapes: Quad["subject"][]): NamedNode[] =>
  shapes.filter(
    (shape, index): shape is NamedNode =>
      shape.termType === "NamedNode" && shapes.findIndex((other) => other.equals(shape)) === index,
  );

// ts-to-zod is an optional peer dependency of this package, needed only by this `/astro` entry.
const zodSchemaFile = (sourceText: string): string =>
  generate({ sourceText, getSchemaName: (name) => `${name}Schema` })
    .getZodSchemasFile("./")
    .replace(`import { z } from "zod";`, `import { z } from "astro:content";`)
    .replace("ts-to-zod", "@shapething/shacl-renderer");

// Each file parsed with its own file:// URL as base IRI, so relative IRIs (e.g. a shape's own `<>`)
// resolve per file.
const parseFiles = async (root: string, patterns: string | string[]): Promise<RdfStore> => {
  const store = RdfStore.createDefault();
  for await (const file of glob(patterns, { cwd: root })) {
    const absolute = path.resolve(root, file);
    const text = await readFile(absolute, "utf8");
    const href = pathToFileURL(absolute).href;
    const quads = rdfParser.parse(stringToStream(text), { path: href, baseIRI: href });
    await importStream(store, quads);
  }
  return store;
};

const importStream = (store: RdfStore, stream: Stream<Quad>): Promise<void> =>
  new Promise((resolve, reject) => {
    store
      .import(stream)
      .on("end", () => resolve())
      .on("error", reject);
  });
