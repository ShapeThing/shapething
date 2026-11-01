import type { Parser } from "@traqula/parser-sparql-1-2";

/**
 * Browser safe part of Typed SPARQL: turns a SPARQL query string into TypeScript declarations without touching the file system.
 *
 * @module
 */

/**
 * Options for the `sparqlTypes` Vite plugin, allowing users to customize the TypeScript types generated for SPARQL queries based on function return types and predicate-object patterns. This enables more precise typings for query results, improving type safety and developer experience when working with SPARQL queries in a TypeScript codebase.
 */
export interface SparqlTypesOptions {
  /**
   * Map from function IRI or prefixed name to its TypeScript return type string.
   *
   * Keys can be:
   *   - A prefixed name:  `"sta:label"`
   *   - A full IRI:       `"http://example.org/ns/label"`
   *
   * Values are TypeScript type expressions inserted verbatim, e.g.
   *   `"Literal"`, `"NamedNode"`, `"NamedNode | Literal"`.
   *
   * When a function is not listed, `Term` is used as the fallback type.
   *
   * @example
   * sparqlTypes({
   *   functions: {
   *     'sta:label': 'Literal',
   *     'sta:icon':  'Literal',
   *   },
   * })
   */
  functions?: Record<string, string>;
  /**
   * Additional predicate → object TypeScript type rules, merged on top of the
   * built-in SHACL/RDF rules.
   *
   * Keys can be prefixed names or full IRIs (same format as `functions`).
   * Values are TypeScript type expressions inserted verbatim.
   *
   * @example
   * sparqlTypes({
   *   predicateObjectTypes: {
   *     'owl:sameAs': 'NamedNode',
   *   },
   * })
   */
  predicateObjectTypes?: Record<string, string>;
}

const SPARQL_KEYWORDS = new Set([
  "SELECT",
  "WHERE",
  "FILTER",
  "OPTIONAL",
  "GRAPH",
  "BIND",
  "UNION",
  "MINUS",
  "ORDER",
  "LIMIT",
  "OFFSET",
  "GROUP",
  "HAVING",
  "AS",
  "BY",
  "ASC",
  "DESC",
  "FROM",
  "NAMED",
  "SERVICE",
  "SILENT",
  "VALUES",
  "INSERT",
  "DELETE",
  "WITH",
  "USING",
  "LOAD",
  "CLEAR",
  "DROP",
  "ADD",
  "MOVE",
  "COPY",
  "CREATE",
  "BASE",
  "PREFIX",
  "CONSTRUCT",
  "DESCRIBE",
  "ASK",
  "NOT",
  "IN",
  "EXISTS",
  "DISTINCT",
  "REDUCED",
  "SEPARATOR",
]);

/**
 * Inserts dummy PREFIX declarations for any prefixed name that is used in the
 * query but not explicitly declared. This lets the parser handle queries that
 * rely on externally-provided prefix mappings.
 */
function addDummyPrefixes(query: string): string {
  const declared = new Set<string>();
  for (const m of query.matchAll(/PREFIX\s+(\w*)\s*:/gi)) {
    declared.add(m[1]);
  }

  const used = new Set<string>();
  for (const m of query.matchAll(/\b([a-zA-Z]\w*):[a-zA-Z_]/g)) {
    if (!SPARQL_KEYWORDS.has(m[1].toUpperCase())) used.add(m[1]);
  }

  const missing = [...used].filter((p) => !declared.has(p));
  if (!missing.length) return query;

  const decls = missing.map((p) => `PREFIX ${p}: <http://dummy/${p}/>`).join("\n");
  return `${decls}\n${query}`;
}

/**
 * Given a TermIri node from the traqula AST, return the lookup key used to
 * match against the user's `functions` option map.
 * Returns `prefix:localName` for prefixed IRIs, or the full IRI value.
 */
function termIriKey(fn: { value: string; prefix?: string }): string {
  return fn.prefix ? `${fn.prefix}:${fn.value}` : fn.value;
}

/**
 * Built-in predicate → object type narrowing rules for well-known SHACL and
 * RDF predicates whose object is always a NamedNode.
 */
const BUILTIN_PREDICATE_OBJECT_TYPES: Record<string, string> = {
  // RDF / OWL
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": "NamedNode",
  "rdf:type": "NamedNode",
  // SHACL target declarations
  "sh:targetClass": "NamedNode",
  "sh:targetSubjectsOf": "NamedNode",
  "sh:targetObjectsOf": "NamedNode",
  // SHACL constraint components — class / datatype / nodeKind are always IRIs
  "sh:class": "NamedNode",
  "sh:datatype": "NamedNode",
  "sh:nodeKind": "NamedNode",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function* walkPatterns(patterns: any[], skipOptional = false): Iterable<any> {
  for (const p of patterns) {
    if (skipOptional && p.type === "pattern" && p.subType === "optional") continue;
    yield p;
    if (Array.isArray(p.patterns)) yield* walkPatterns(p.patterns, skipOptional);
    if (p.type === "query" && Array.isArray(p.where?.patterns))
      yield* walkPatterns(p.where.patterns, skipOptional);
  }
}

/**
 * Walks the WHERE clause pattern tree and returns the set of variable names
 * that are bound exclusively via BOUND(), meaning their runtime value is
 * always xsd:boolean.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectBooleanVars(patterns: any[]): Set<string> {
  const vars = new Set<string>();
  for (const p of walkPatterns(patterns)) {
    if (
      p.type === "pattern" &&
      p.subType === "bind" &&
      p.expression?.type === "expression" &&
      p.expression.subType === "operation" &&
      p.expression.operator === "bound"
    ) {
      vars.add(p.variable.value);
    }
  }
  return vars;
}

/**
 * Walks the WHERE clause pattern tree and returns the set of variable names
 * that appear as the graph name in a GRAPH clause. Variables used as graph
 * names are always IRIs — they can never be blank nodes or literals.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectGraphNameVars(patterns: any[]): Set<string> {
  const vars = new Set<string>();
  for (const p of walkPatterns(patterns)) {
    if (
      p.type === "pattern" &&
      p.subType === "graph" &&
      p.name?.type === "term" &&
      p.name.subType === "variable"
    ) {
      vars.add(p.name.value);
    }
  }
  return vars;
}

/**
 * Walks the WHERE clause pattern tree and returns the set of variable names
 * that appear in the subject position of any triple pattern. In RDF, subjects
 * can only be IRIs or blank nodes — never literals.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectSubjectVars(patterns: any[]): Set<string> {
  const vars = new Set<string>();
  for (const p of walkPatterns(patterns)) {
    if (p.type === "pattern" && p.subType === "bgp") {
      for (const triple of p.triples ?? []) {
        const subj = triple.subject;
        if (subj?.type === "term" && subj.subType === "variable") {
          vars.add(subj.value);
        }
      }
    }
  }
  return vars;
}

/**
 * Walks the WHERE clause pattern tree and returns the set of variable names
 * that are definitely bound — i.e. they appear outside any OPTIONAL block.
 * Variables that only ever appear inside OPTIONAL may be unbound in query
 * results and therefore need an optional (`?:`) property.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectDefinitelyBoundVars(patterns: any[]): Set<string> {
  const vars = new Set<string>();
  for (const p of walkPatterns(patterns, true)) {
    if (
      p.type === "pattern" &&
      p.subType === "graph" &&
      p.name?.type === "term" &&
      p.name.subType === "variable"
    ) {
      vars.add(p.name.value);
    }
    if (p.type === "pattern" && p.subType === "bgp") {
      for (const triple of p.triples ?? []) {
        for (const part of [triple.subject, triple.predicate, triple.object]) {
          if (part?.type === "term" && part.subType === "variable") vars.add(part.value);
        }
      }
    }
    if (p.type === "pattern" && p.subType === "bind" && p.variable?.value) {
      vars.add(p.variable.value);
    }
  }
  return vars;
}

/**
 * Walks the WHERE clause pattern tree and returns a map from variable name →
 * TypeScript type for variables appearing in object position of predicates
 * with a known fixed object type (SHACL rules + user config).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectPredicateObjectVars(
  patterns: any[],
  options: SparqlTypesOptions,
): Map<string, string> {
  const predicateRules = { ...BUILTIN_PREDICATE_OBJECT_TYPES, ...options.predicateObjectTypes };
  const varTypes = new Map<string, string>();
  for (const p of walkPatterns(patterns)) {
    if (p.type === "pattern" && p.subType === "bgp") {
      for (const triple of p.triples ?? []) {
        const pred = triple.predicate;
        if (pred?.type === "term" && pred.subType !== "variable") {
          const key = termIriKey(pred as { value: string; prefix?: string });
          const objType = predicateRules[key];
          if (objType) {
            const obj = triple.object;
            if (obj?.type === "term" && obj.subType === "variable" && !varTypes.has(obj.value)) {
              varTypes.set(obj.value, objType);
            }
          }
        }
      }
    }
  }
  return varTypes;
}

/**
 * Walks the WHERE clause FILTERs and returns a map from variable name →
 * TypeScript type for variables narrowed by a filter condition:
 *   - `FILTER(LANG(?x) = "en")`        → `LiteralWithLanguage<'en'>`
 *   - `FILTER(langMatches(LANG(?x), "en"))` / `LANG(?x) != ""` → `Literal`
 *   - `FILTER(isNumeric(?x))`          → `NumericLiteral`
 *   - `FILTER(isLiteral(?x))`          → `Literal`
 *   - `FILTER(isIRI(?x))` / `isURI`    → `NamedNode`
 *   - `FILTER(isBlank(?x))`            → `BlankNode`
 * Conditions combined with `&&` are inspected individually.
 */
const TYPE_CHECK_OPERATORS: Record<string, string> = {
  isnumeric: "NumericLiteral",
  isliteral: "Literal",
  isiri: "NamedNode",
  isuri: "NamedNode",
  isblank: "BlankNode",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectFilterVars(patterns: any[]): Map<string, string> {
  const varTypes = new Map<string, string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const langVar = (e: any): string | undefined =>
    e?.type === "expression" &&
    e.subType === "operation" &&
    e.operator === "lang" &&
    e.args?.[0]?.type === "term" &&
    e.args[0].subType === "variable"
      ? e.args[0].value
      : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plainString = (e: any): string | undefined =>
    e?.type === "term" && e.subType === "literal" && typeof e.langOrIri !== "object"
      ? e.value
      : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visit = (e: any) => {
    if (e?.type !== "expression" || e.subType !== "operation") return;
    const [a, b] = e.args ?? [];
    if (e.operator === "&&") {
      for (const arg of e.args ?? []) visit(arg);
    } else if (e.operator === "=") {
      const v = langVar(a) ?? langVar(b);
      const lang = langVar(a) ? plainString(b) : plainString(a);
      // LANG(?x) = "" means a plain (non language tagged) literal — leave that alone
      if (v && lang) varTypes.set(v, `LiteralWithLanguage<'${lang.toLowerCase()}'>`);
    } else if (e.operator in TYPE_CHECK_OPERATORS) {
      if (a?.type === "term" && a.subType === "variable") {
        const current = varTypes.get(a.value);
        // isLiteral() should not widen a more specific literal type
        if (!(e.operator === "isliteral" && current)) {
          varTypes.set(a.value, TYPE_CHECK_OPERATORS[e.operator]);
        }
      }
    } else if (e.operator === "langmatches" || e.operator === "!=") {
      const v = langVar(a) ?? langVar(b);
      if (v && !varTypes.has(v)) varTypes.set(v, "Literal");
    }
  };

  for (const p of walkPatterns(patterns)) {
    if (p.type === "pattern" && p.subType === "filter") visit(p.expression);
  }
  return varTypes;
}

/**
 * Walks the WHERE clause pattern tree and returns a map from variable name →
 * TypeScript type for every variable bound via BIND() where we can derive a
 * type more specific than the generic fallback. Variables already classified
 * as boolean (via collectBooleanVars) are skipped so that the
 * aggregate-based xsd:boolean narrowing continues to work.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectBindVarTypes(
  patterns: any[],
  options: SparqlTypesOptions,
  boolVars: Set<string>,
  knownVarTypes: Map<string, string>,
  prefixes: Map<string, string>,
): Map<string, string> {
  const bindTypes = new Map<string, string>();
  for (const p of walkPatterns(patterns)) {
    if (p.type === "pattern" && p.subType === "bind") {
      const varName: string | undefined = p.variable?.value;
      if (varName && !boolVars.has(varName) && !bindTypes.has(varName)) {
        const t = exprType(p.expression, options, boolVars, knownVarTypes, prefixes);
        // Only record when we can be more specific than the plain-variable default
        if (t !== "NamedNode | BlankNode | Literal") {
          bindTypes.set(varName, t);
        }
      }
    }
  }
  return bindTypes;
}

const XSD = "http://www.w3.org/2001/XMLSchema#";

/**
 * Namespaces that `LiteralWithDatatype` can expand at the type level. Keep in
 * sync with `DatatypePrefixes` in index.ts.
 */
const DATATYPE_PREFIXES: Record<string, string> = {
  xsd: XSD,
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
};

/** Emits `LiteralWithDatatype<...>`, compacting the IRI to `prefix:local` when possible. */
function literalWithDatatype(iri: string): string {
  for (const [prefix, ns] of Object.entries(DATATYPE_PREFIXES)) {
    if (iri.startsWith(ns)) return `LiteralWithDatatype<'${prefix}:${iri.slice(ns.length)}'>`;
  }
  return `LiteralWithDatatype<'${iri}'>`;
}

const xsdLiteral = (local: string) => literalWithDatatype(XSD + local);

/**
 * Result types of SPARQL built-in operations (as named by the traqula AST).
 * Operators not listed here fall back to `Term`.
 */
const BUILTIN_OPERATION_TYPES: Record<string, string> = {
  // Always simple literals (xsd:string)
  str: xsdLiteral("string"),
  lang: xsdLiteral("string"),
  encode_for_uri: xsdLiteral("string"),
  struuid: xsdLiteral("string"),
  md5: xsdLiteral("string"),
  sha1: xsdLiteral("string"),
  sha256: xsdLiteral("string"),
  sha384: xsdLiteral("string"),
  sha512: xsdLiteral("string"),
  tz: xsdLiteral("string"),
  // String functions that may preserve a language tag
  lcase: "Literal",
  ucase: "Literal",
  substr: "Literal",
  strbefore: "Literal",
  strafter: "Literal",
  concat: "Literal",
  replace: "Literal",
  strlang: "Literal",
  strdt: "Literal",
  // Numeric
  strlen: xsdLiteral("integer"),
  year: xsdLiteral("integer"),
  month: xsdLiteral("integer"),
  day: xsdLiteral("integer"),
  hours: xsdLiteral("integer"),
  minutes: xsdLiteral("integer"),
  seconds: xsdLiteral("decimal"),
  rand: xsdLiteral("double"),
  abs: "NumericLiteral",
  ceil: "NumericLiteral",
  floor: "NumericLiteral",
  round: "NumericLiteral",
  "+": "NumericLiteral",
  "-": "NumericLiteral",
  "*": "NumericLiteral",
  "/": "NumericLiteral",
  // Date / time
  now: xsdLiteral("dateTime"),
  timezone: xsdLiteral("dayTimeDuration"),
  // Booleans
  bound: xsdLiteral("boolean"),
  isiri: xsdLiteral("boolean"),
  isuri: xsdLiteral("boolean"),
  isblank: xsdLiteral("boolean"),
  isliteral: xsdLiteral("boolean"),
  isnumeric: xsdLiteral("boolean"),
  istriple: xsdLiteral("boolean"),
  hasdirlang: xsdLiteral("boolean"),
  hasdir: xsdLiteral("boolean"),
  regex: xsdLiteral("boolean"),
  contains: xsdLiteral("boolean"),
  strstarts: xsdLiteral("boolean"),
  strends: xsdLiteral("boolean"),
  langmatches: xsdLiteral("boolean"),
  sameterm: xsdLiteral("boolean"),
  in: xsdLiteral("boolean"),
  notin: xsdLiteral("boolean"),
  "!": xsdLiteral("boolean"),
  "&&": xsdLiteral("boolean"),
  "||": xsdLiteral("boolean"),
  "=": xsdLiteral("boolean"),
  "!=": xsdLiteral("boolean"),
  "<": xsdLiteral("boolean"),
  ">": xsdLiteral("boolean"),
  "<=": xsdLiteral("boolean"),
  ">=": xsdLiteral("boolean"),
  // Term constructors
  iri: "NamedNode",
  uri: "NamedNode",
  datatype: "NamedNode",
  bnode: "BlankNode",
};

/** Joins type strings into a deduplicated union. */
function unionTypes(types: string[]): string {
  const parts = new Set<string>();
  for (const t of types) for (const part of t.split(" | ")) parts.add(part);
  if (parts.has("Term")) return "Term";
  return [...parts].join(" | ");
}

/**
 * Resolves a TermIri node from the traqula AST to a full IRI using the
 * prefixes declared in the query. `xsd:` resolves to XML Schema even when
 * not declared.
 */
function resolveIri(fn: { value: string; prefix?: string }, prefixes: Map<string, string>): string {
  if (fn.prefix === undefined) return fn.value;
  const ns = prefixes.get(fn.prefix) ?? (fn.prefix === "xsd" ? XSD : undefined);
  return ns ? ns + fn.value : `${fn.prefix}:${fn.value}`;
}

/**
 * Derives the TypeScript type string for an expression node appearing in a
 * projected BIND slot, using the user's function map as a hint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exprType(
  expression: any,
  options: SparqlTypesOptions,
  boolVars: Set<string>,
  knownVarTypes: Map<string, string>,
  prefixes: Map<string, string>,
): string {
  const recurse = (e: unknown) => exprType(e, options, boolVars, knownVarTypes, prefixes);

  // Plain variable reference — look up against all collected type rules first
  if (expression.type === "term" && expression.subType === "variable") {
    const varName: string = expression.value;
    if (boolVars.has(varName)) return xsdLiteral("boolean");
    return knownVarTypes.get(varName) ?? "NamedNode | BlankNode | Literal";
  }

  // Constant terms
  if (expression.type === "term") {
    if (expression.subType === "namedNode") return "NamedNode";
    if (expression.subType === "literal") {
      const dt = expression.langOrIri;
      if (dt && typeof dt === "object") return literalWithDatatype(resolveIri(dt, prefixes));
      return "Literal";
    }
    return "Term";
  }

  // Custom or built-in function call
  if (expression.type === "expression" && expression.subType === "functionCall") {
    const fn = expression.function as { value: string; prefix?: string };
    const userType =
      options.functions?.[termIriKey(fn)] ?? options.functions?.[resolveIri(fn, prefixes)];
    if (userType) return userType;
    // XSD constructor casts, e.g. xsd:integer(?x)
    const iri = resolveIri(fn, prefixes);
    if (iri.startsWith(XSD)) return literalWithDatatype(iri);
    return "Term";
  }

  if (expression.type === "expression" && expression.subType === "patternOperation") {
    // EXISTS / NOT EXISTS
    return xsdLiteral("boolean");
  }

  if (expression.type === "expression" && expression.subType === "operation") {
    const op: string = expression.operator;
    const args: unknown[] = expression.args ?? [];
    if (op === "coalesce" && args.length) return unionTypes(args.map(recurse));
    if (op === "if" && args.length === 3) return unionTypes([recurse(args[1]), recurse(args[2])]);
    return BUILTIN_OPERATION_TYPES[op] ?? "Term";
  }

  // Aggregate functions never produce a NamedNode or BlankNode, except for
  // SAMPLE / MIN / MAX which return one of their input values.
  if (expression.type === "expression" && expression.subType === "aggregate") {
    const inner = expression.expression?.[0];
    switch (expression.aggregation) {
      case "count":
        return xsdLiteral("integer");
      case "group_concat":
        return xsdLiteral("string");
      case "sample":
      case "min":
      case "max":
        return inner && inner.type !== "wildcard" ? recurse(inner) : "Term";
      default:
        // SUM / AVG: a numeric literal whose datatype depends on the input
        return "NumericLiteral";
    }
  }

  return "Term";
}

/** Collects `PREFIX p: <iri>` declarations from the raw query string. */
function collectPrefixes(query: string): Map<string, string> {
  const prefixes = new Map<string, string>();
  for (const m of query.matchAll(/PREFIX\s+(\w*)\s*:\s*<([^>]*)>/gi)) prefixes.set(m[1], m[2]);
  return prefixes;
}

/**
 * Pure function: parses a SPARQL query string and returns the `.rq.d.ts` file
 * content, or `null` if no type declaration can be generated (non-SELECT
 * queries, SELECT *, parse errors, empty projections).
 */
export function generateDts(
  query: string,
  options: SparqlTypesOptions,
  parser: Parser,
): string | null {
  let ast: ReturnType<typeof parser.parse>;
  try {
    ast = parser.parse(addDummyPrefixes(query));
  } catch {
    return null;
  }

  if (ast.type !== "query" || ast.subType !== "select") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wherePatterns = (ast as any).where?.patterns ?? [];
  const boolVars = collectBooleanVars(wherePatterns);
  const graphNameVars = collectGraphNameVars(wherePatterns);
  const subjectVars = collectSubjectVars(wherePatterns);
  const definitelyBoundVars = collectDefinitelyBoundVars(wherePatterns);
  const predicateObjectVars = collectPredicateObjectVars(wherePatterns, options);
  const filterVars = collectFilterVars(wherePatterns);

  // Build a unified variable → type map for cross-cutting lookups (e.g. aliased expressions)
  const knownVarTypes = new Map<string, string>();
  for (const v of subjectVars) knownVarTypes.set(v, "NamedNode | BlankNode");
  for (const [k, v] of predicateObjectVars) knownVarTypes.set(k, v);
  for (const [k, v] of filterVars) knownVarTypes.set(k, v);
  for (const v of graphNameVars) knownVarTypes.set(v, "NamedNode");

  const prefixes = collectPrefixes(query);
  const bindVarTypes = collectBindVarTypes(
    wherePatterns,
    options,
    boolVars,
    knownVarTypes,
    prefixes,
  );

  const fields: Array<{ name: string; tsType: string; optional: boolean }> = [];

  for (const v of ast.variables) {
    if (v.type === "wildcard") return null; // SELECT * – variables unknown at compile time

    if (v.type === "term" && v.subType === "variable") {
      // Direct variable projection: SELECT ?foo
      // Priority: GRAPH name → BOUND() bool → FILTER narrowing → predicate rule → subject position → WHERE-clause BIND type → generic fallback
      const tsType = graphNameVars.has(v.value)
        ? "NamedNode"
        : boolVars.has(v.value)
          ? xsdLiteral("boolean")
          : (filterVars.get(v.value) ??
            predicateObjectVars.get(v.value) ??
            (subjectVars.has(v.value) ? "NamedNode | BlankNode" : undefined) ??
            bindVarTypes.get(v.value) ??
            "NamedNode | BlankNode | Literal");
      const optional = !definitelyBoundVars.has(v.value);
      fields.push({ name: v.value, tsType, optional });
    } else if (v.type === "pattern" && v.subType === "bind") {
      // Aliased expression: SELECT (?expr AS ?foo) — always bound
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields.push({
        name: (v as any).variable.value,
        tsType: exprType((v as any).expression, options, boolVars, knownVarTypes, prefixes),
        optional: false,
      });
    }
  }

  if (!fields.length) return null;

  const usesLiteralWithDatatype = fields.some((f) => f.tsType.includes("LiteralWithDatatype"));

  // Collect which @rdfjs/types symbols are actually needed
  const usedRdfTypes = new Set<string>();
  for (const { tsType } of fields) {
    if (tsType.includes("NamedNode")) usedRdfTypes.add("NamedNode");
    if (tsType.includes("BlankNode")) usedRdfTypes.add("BlankNode");
    if (tsType.includes("Literal")) usedRdfTypes.add("Literal");
    if (tsType === "Term" || tsType.includes("| Term") || tsType.includes("Term |")) {
      usedRdfTypes.add("Term");
    }
  }
  // LiteralWithDatatype<T> is defined as Literal & { datatype: NamedNode<T> }
  if (usesLiteralWithDatatype) {
    usedRdfTypes.add("Literal");
    usedRdfTypes.add("NamedNode");
  }

  const rdfTypesImport = `import type { ${[...usedRdfTypes].sort().join(", ")} } from '@rdfjs/types'`;

  // Build the @/rdf import — always needs Prettify and TypedQuery; optionally LiteralWithDatatype
  const localImports = ["Prettify", "TypedQuery"];
  if (usesLiteralWithDatatype) localImports.push("LiteralWithDatatype");
  for (const helper of ["LiteralWithLanguage", "NumericLiteral"]) {
    if (fields.some((f) => f.tsType.includes(helper))) localImports.push(helper);
  }
  const localImport = `import type { ${localImports.sort().join(", ")} } from '@shapething/typed-sparql'`;

  const body = fields
    .map(({ name, tsType, optional }) => `  ${name}${optional ? "?" : ""}: ${tsType}`)
    .join("\n");

  return `/* eslint-disable @typescript-eslint/no-unused-vars */\n${rdfTypesImport}\n${localImport}\n\ninterface QueryResult {\n${body}\n}\n\ndeclare const _default: TypedQuery<Prettify<QueryResult>>\nexport default _default\n`;
}
