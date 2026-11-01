import { Parser } from "@traqula/parser-sparql-1-2";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import type { SparqlTypesOptions } from "./generate.ts";
import { findRqFiles, processRqFile } from "./index.ts";

export type { SparqlTypesOptions };

/**
 * A Vite plugin that processes SPARQL query files (.rq) and generates corresponding TypeScript types.
 * This allows for type-safe usage of SPARQL queries in a TypeScript codebase.
 * @param options - Options for customizing the generated TypeScript types.
 * @returns A Vite plugin instance.
 */
export function typedSparql(options: SparqlTypesOptions = {}): Plugin {
  const parser = new Parser();

  return {
    name: "typed-sparql",
    enforce: "pre",

    buildStart() {
      const srcDir = path.resolve(process.cwd(), "src");
      for (const rqFile of findRqFiles(srcDir)) {
        processRqFile(rqFile, options, parser);
        this.addWatchFile(rqFile);
      }
    },

    load(id) {
      // Handle bare `.rq` imports (no ?raw suffix) — return the file content as
      // a default-exported string so the runtime value matches the TypedQuery<T>
      // declaration generated in the .rq.d.ts file.
      if (id.endsWith(".rq")) {
        const content = fs.readFileSync(id, "utf-8");
        return `export default ${JSON.stringify(content)}\n`;
      }
    },

    watchChange(id, { event }) {
      if (id.endsWith(".rq") && event !== "delete") {
        processRqFile(id, options, parser);
      }
    },
  };
}
