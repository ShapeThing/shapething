import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Parser, type Term } from "n3";
import type { EncodedQuads } from "../src/helpers/quadTuples.ts";

function encodeTerm(term: Term): string {
  switch (term.termType) {
    case "NamedNode":
      return `<${term.value}`;
    case "BlankNode":
      return `_${term.value}`;
    case "Literal":
      return `"${JSON.stringify([term.value, term.language, term.datatype.value])}`;
    case "DefaultGraph":
      return "D";
    default:
      throw new Error(`Cannot encode a ${term.termType} term`);
  }
}

/**
 * Parses turtle into EncodedQuads (see src/helpers/quadTuples.ts). `blankNodePrefix` keeps blank
 * node labels unique per source file: these graphs used to be concatenated as text and parsed in
 * one go, and are now merged as already-parsed quads, so two files' `_:b0` must not collide.
 */
export function encodeTurtle(turtle: string, blankNodePrefix: string): EncodedQuads {
  const quads = new Parser({ blankNodePrefix }).parse(turtle);
  const terms: string[] = [];
  const indexes = new Map<string, number>();
  const encoded: number[] = [];
  for (const quad of quads) {
    for (const term of [quad.subject, quad.predicate, quad.object, quad.graph]) {
      const key = encodeTerm(term);
      let index = indexes.get(key);
      if (index === undefined) {
        index = terms.length;
        terms.push(key);
        indexes.set(key, index);
      }
      encoded.push(index);
    }
  }
  return { terms, quads: encoded };
}

/**
 * `import graph from "./x.ttl?quads"` - the turtle file parsed at build time into EncodedQuads,
 * so the browser never runs a turtle parser for it. Works in both the Vite dev server and
 * `vp pack` (which, like for `?raw`, has no built-in handling for an import query).
 */
export function ttlQuadsPlugin(root: string) {
  const suffix = "?quads";
  return {
    name: "ttl-quads",
    enforce: "pre" as const,
    async resolveId(
      this: {
        resolve: (
          source: string,
          importer: string | undefined,
          options: { skipSelf: boolean },
        ) => Promise<{ id: string } | null>;
      },
      source: string,
      importer: string | undefined,
    ) {
      if (!source.endsWith(suffix)) return null;
      const resolved = await this.resolve(source.slice(0, -suffix.length), importer, {
        skipSelf: true,
      });
      return resolved ? `${resolved.id}${suffix}` : null;
    },
    async load(this: { addWatchFile?: (file: string) => void }, id: string) {
      if (!id.endsWith(suffix)) return null;
      const file = id.slice(0, -suffix.length);
      this.addWatchFile?.(file);
      const turtle = await fs.readFile(file, "utf-8");
      const prefix = createHash("sha1").update(path.relative(root, file)).digest("hex").slice(0, 8);
      return `export default ${JSON.stringify(encodeTurtle(turtle, `${prefix}_`))};`;
    },
  };
}
