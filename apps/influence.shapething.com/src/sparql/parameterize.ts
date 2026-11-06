import type { Literal, NamedNode } from "@rdfjs/types";

/** The terms a query can be given: entity IRIs and search strings. */
export type ParameterTerm = NamedNode | Literal;
export type Parameters = Record<string, ParameterTerm | readonly ParameterTerm[]>;

const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";

// The characters an IRIREF may not have (SPARQL 1.1, production 139): these, and the control
// characters and space (U+0000 to U+0020).
const INVALID_IRI_CHARACTERS = /[<>"{}|^`\\]/;
const hasControlCharacter = (text: string) =>
  [...text].some((character) => character.charCodeAt(0) <= 0x20);

const escapeIri = (iri: string): string => {
  if (INVALID_IRI_CHARACTERS.test(iri) || hasControlCharacter(iri)) {
    throw new Error(`Not a valid IRI for a query: ${iri}`);
  }
  return `<${iri}>`;
};

const escapeString = (value: string): string =>
  `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")}"`;

const LANGUAGE_TAG = /^[a-zA-Z]+(-[a-zA-Z0-9]+)*$/;

export const termToSparql = (term: ParameterTerm): string => {
  if (term.termType === "NamedNode") return escapeIri(term.value);

  const lexical = escapeString(term.value);
  if (term.language) {
    if (!LANGUAGE_TAG.test(term.language)) throw new Error(`Not a language tag: ${term.language}`);
    return `${lexical}@${term.language}`;
  }
  if (term.datatype.value !== XSD_STRING) return `${lexical}^^${escapeIri(term.datatype.value)}`;
  return lexical;
};

/**
 * Fills in the `$name` variables of a query. The .rq files keep them as variables, so that
 * typed-sparql can still read the query.
 *
 * - One term replaces `$name` everywhere in the query.
 * - A list of terms turns `$name` into `?name`, bound by a VALUES clause at the start of the
 *   outermost WHERE block.
 */
export const parameterize = (query: string, parameters: Parameters = {}): string => {
  let result = query;
  const valuesClauses: string[] = [];

  for (const [name, value] of Object.entries(parameters)) {
    if (!/^\w+$/.test(name)) throw new Error(`Not a variable name: ${name}`);
    if (!new RegExp(`\\$${name}\\b`).test(result)) throw new Error(`The query has no $${name}`);
    const variable = new RegExp(`\\$${name}\\b`, "g");

    if (Array.isArray(value)) {
      const terms = value as readonly ParameterTerm[];
      result = result.replace(variable, `?${name}`);
      valuesClauses.push(`VALUES ?${name} { ${terms.map(termToSparql).join(" ")} }`);
    } else {
      const term = termToSparql(value as ParameterTerm);
      // A function replacement, so "$" characters in the term are never read as patterns.
      result = result.replace(variable, () => term);
    }
  }

  if (valuesClauses.length) {
    const where = /\bWHERE\s*\{/i;
    if (!where.test(result)) throw new Error("A list parameter needs a WHERE block to bind it in");
    result = result.replace(where, (match) => `${match}\n  ${valuesClauses.join("\n  ")}`);
  }

  return result;
};
