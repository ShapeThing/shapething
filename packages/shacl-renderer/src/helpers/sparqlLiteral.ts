import type { Term } from "@rdfjs/types";

// Minimal SPARQL string-literal escaping for a value about to be spliced into generated query text.
export function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * `term` as a SPARQL term, for splicing into generated query text (VALUES, IN (...), comparison
 * operands). Blank nodes have no query-text form that means "this exact node" - undefined, so a
 * caller drops them rather than silently matching any node.
 */
export function termToSparql(term: Term): string | undefined {
  switch (term.termType) {
    case "NamedNode":
      return `<${term.value}>`;
    case "Literal": {
      const lexical = `"${escapeSparqlLiteral(term.value)}"`;
      if (term.language) return `${lexical}@${term.language}`;
      return `${lexical}^^<${term.datatype.value}>`;
    }
    default:
      return undefined;
  }
}
