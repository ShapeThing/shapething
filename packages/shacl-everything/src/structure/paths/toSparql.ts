import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { prefixedIri } from "@/helpers/prefixedIri.ts";

export type ToSparqlOptions = {
  // Renders each predicate as `prefix:localName` (helpers/prefixedIri.ts) where a known prefix
  // matches, falling back to the full `<iri>` form otherwise - for human-facing display (e.g. a
  // title tooltip) where a shorter, readable path reads better than one that's copy-pasteable as
  // a canonical query fragment. Off by default: callers that use the result as a stable identity
  // (dataId(), nestedAncestorPath(), elementKey.ts, groupPropertyShapesByPath's path-equality
  // check) need the exact, unambiguous `<iri>` form untouched.
  prefixed?: boolean;
  // Passed straight through to prefixedIri() as its own source-declared-prefixes override
  // (typically Environment.sourcePrefixes) - ignored unless `prefixed` is also true. This layer
  // deliberately has no Environment access of its own (see PropertyUIElement.isReadOnly's same
  // note), so a caller that wants a document's own alias reflected here has to hand it in.
  sourcePrefixes?: Record<string, string>;
};

/**
 * Compiles a parsed SHACL property path into a SPARQL 1.1 property path
 * expression. Unlike `toGrapoi`, SPARQL's path grammar has native grouping,
 * so every `PropertyPath` has a valid, exact translation - nothing here
 * needs to throw.
 */
export function toSparql(
  path: PropertyPath,
  options?: ToSparqlOptions,
): string {
  switch (path.type) {
    case "predicate":
      return options?.prefixed
        ? prefixedIri(path.predicate, options.sourcePrefixes) ??
          `<${path.predicate.value}>`
        : `<${path.predicate.value}>`;

    case "sequence":
      return path.items.map((item) => group(item, options)).join(" / ");

    case "alternative":
      return path.items.map((item) => group(item, options)).join(" | ");

    case "inverse":
      return `^${group(path.path, options)}`;

    case "zeroOrMore":
      return `${group(path.path, options)}*`;

    case "oneOrMore":
      return `${group(path.path, options)}+`;

    case "zeroOrOne":
      return `${group(path.path, options)}?`;
  }
}

// Predicates are already atomic and never need parentheses; every other
// path type is wrapped so its meaning can't shift depending on what it's
// nested under (e.g. `^p*` parses as `^(p*)`, not `(^p)*`).
function group(path: PropertyPath, options?: ToSparqlOptions): string {
  const serialized = toSparql(path, options);
  return path.type === "predicate" ? serialized : `(${serialized})`;
}
