import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { sh } from "@/helpers/namespaces.ts";

export type PrefixDeclaration = { prefix: string; namespace: string };

/**
 * The prefix declarations a SPARQL-based constraint or rule gets from its sh:prefixes (SHACL 1.2
 * SPARQL Extensions, "Prefix Declarations for SPARQL Queries"): every sh:declare of every
 * sh:prefixes value, each a node with one sh:prefix and one sh:namespace. A declaration missing
 * either is skipped; a prefix declared twice keeps its first namespace, in the order the graph
 * gives them.
 */
export function declaredPrefixes(node: Term, graph: RdfStore): PrefixDeclaration[] {
  const declarations = new Map<string, string>();
  for (const { object: ontology } of graph.getQuads(node, sh("prefixes"))) {
    for (const { object: declaration } of graph.getQuads(ontology, sh("declare"))) {
      const prefix = graph.getQuads(declaration, sh("prefix"))[0]?.object.value;
      const namespace = graph.getQuads(declaration, sh("namespace"))[0]?.object.value;
      if (prefix === undefined || !namespace || declarations.has(prefix)) continue;
      declarations.set(prefix, namespace);
    }
  }
  return [...declarations].map(([prefix, namespace]) => ({ prefix, namespace }));
}

/**
 * A PREFIX line for every declaration `query` doesn't declare itself - what goes in front of it to
 * get the query the SHACL processor actually runs.
 */
export function prefixDeclarationLines(query: string, declarations: PrefixDeclaration[]): string[] {
  return declarations
    .filter(({ prefix }) => !declaresPrefix(query, prefix))
    .map(({ prefix, namespace }) => `PREFIX ${prefix}: <${namespace}>`);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whether the query has its own PREFIX for `prefix` (case-insensitive keyword, as in SPARQL).
function declaresPrefix(query: string, prefix: string): boolean {
  return new RegExp(`(^|\\s)PREFIX\\s+${escapeRegExp(prefix)}\\s*:`, "i").test(query);
}
