import { Parser } from "@traqula/parser-sparql-1-2";
import fs from "node:fs";
import path from "node:path";
import { generateDts, type SparqlTypesOptions } from "./generate.ts";
import type { Literal, NamedNode } from "@rdfjs/types";
export { typedSparql } from "./vite-plugin.ts";
export { generateDts, type SparqlTypesOptions } from "./generate.ts";

/**
 * This module provides a Vite plugin that generates TypeScript types for SPARQL SELECT queries defined in .rq files. By analyzing the structure of the SPARQL query and applying user-defined type rules, it produces precise typings for query results, enabling type-safe usage of SPARQL queries in a TypeScript codebase.
 *
 * @example
 * ```ts
 * import { typedSparql } from "@shapething/typed-sparql";
 *
 * const plugin = typedSparql({
 *   functions: {
 *     'sta:label': 'Literal',
 *     'sta:icon':  'Literal',
 *   },
 * });
 * ```
 *
 * @module
 */

/**
 * Finds .rq files in the given directory and all subdirectories, ignoring commonly excluded ones like node_modules and .git. Returns an array of file paths.
 */
export function findRqFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !["node_modules", ".git", "dist"].includes(entry.name)) {
        files.push(...findRqFiles(full));
      } else if (entry.isFile() && entry.name.endsWith(".rq")) {
        files.push(full);
      }
    }
  } catch {
    /* ignore unreadable dirs */
  }
  return files;
}

/**
 * Processes a .rq file, generating a corresponding TypeScript declaration file.
 * @param rqPath - The path to the .rq file.
 * @param options - Options for SPARQL type generation.
 * @param parser - The SPARQL parser instance.
 */
export function processRqFile(rqPath: string, options: SparqlTypesOptions, parser: Parser): void {
  let query: string;
  try {
    query = fs.readFileSync(rqPath, "utf-8");
  } catch {
    return;
  }

  let dtsContent: string | null;
  try {
    dtsContent = generateDts(query, options, parser);
  } catch (e) {
    console.warn(`[sparql-types] Failed to parse ${rqPath}: ${(e as Error).message}`);
    return;
  }

  if (dtsContent !== null) {
    fs.writeFileSync(`${rqPath}.d.ts`, dtsContent, "utf-8");
  }
}

/**
 * Prefixes that may be used in the datatype argument of `LiteralWithDatatype`.
 */
export type DatatypePrefixes = {
  xsd: "http://www.w3.org/2001/XMLSchema#";
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
};

/**
 * Expands a `prefix:local` datatype name (e.g. `'xsd:string'`) to its full IRI.
 * Full IRIs and unknown prefixes are returned unchanged.
 */
export type ExpandDatatype<T extends string> =
  T extends `${infer P extends keyof DatatypePrefixes}:${infer L}`
    ? `${DatatypePrefixes[P]}${L}`
    : T;

/**
 * An RDF literal with a specific datatype. The datatype may be given as a full
 * IRI or compacted with a known prefix (`'xsd:string'`); `datatype.value` is
 * always typed as the full IRI.
 */
export type LiteralWithDatatype<TDatatype extends string> = Literal & {
  datatype: NamedNode<ExpandDatatype<TDatatype>>;
};

/**
 * A language tagged RDF literal with a specific (lowercase) language tag.
 */
export type LiteralWithLanguage<TLanguage extends string> = Literal & {
  language: TLanguage;
};

/**
 * Datatypes for which SPARQL's `isNumeric()` returns true.
 */
export type NumericDatatype =
  | "xsd:integer"
  | "xsd:decimal"
  | "xsd:float"
  | "xsd:double"
  | "xsd:nonPositiveInteger"
  | "xsd:negativeInteger"
  | "xsd:long"
  | "xsd:int"
  | "xsd:short"
  | "xsd:byte"
  | "xsd:nonNegativeInteger"
  | "xsd:unsignedLong"
  | "xsd:unsignedInt"
  | "xsd:unsignedShort"
  | "xsd:unsignedByte"
  | "xsd:positiveInteger";

/**
 * A literal with one of the numeric XSD datatypes.
 */
export type NumericLiteral = LiteralWithDatatype<NumericDatatype>;

/**
 * Expands a type so that IDEs display the concrete property names instead of
 * a named alias. Useful for generated query-result interfaces.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// Unique symbol used as the phantom brand — prevents accidental structural matches
declare const __queryBrand: unique symbol;

/**
 * A SPARQL SELECT query string that carries its result row type as a phantom
 * type parameter. At runtime this is just a plain string; the type parameter
 * is erased and only exists for TypeScript inference.
 *
 * Generated automatically by the sparql-types Vite plugin for every .rq file.
 */
export type TypedQuery<TRow extends object> = string & { readonly [__queryBrand]: TRow };
