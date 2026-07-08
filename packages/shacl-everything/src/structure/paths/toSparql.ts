import type { PropertyPath } from "./parsePropertyPath.ts";

/**
 * Compiles a parsed SHACL property path into a SPARQL 1.1 property path
 * expression. Unlike `toGrapoi`, SPARQL's path grammar has native grouping,
 * so every `PropertyPath` has a valid, exact translation - nothing here
 * needs to throw.
 */
export function toSparql(path: PropertyPath): string {
    switch (path.type) {
        case "predicate":
            return `<${path.predicate.value}>`;

        case "sequence":
            return path.items.map(group).join("/");

        case "alternative":
            return path.items.map(group).join("|");

        case "inverse":
            return `^${group(path.path)}`;

        case "zeroOrMore":
            return `${group(path.path)}*`;

        case "oneOrMore":
            return `${group(path.path)}+`;

        case "zeroOrOne":
            return `${group(path.path)}?`;
    }
}

// Predicates are already atomic and never need parentheses; every other
// path type is wrapped so its meaning can't shift depending on what it's
// nested under (e.g. `^p*` parses as `^(p*)`, not `(^p)*`).
function group(path: PropertyPath): string {
    const serialized = toSparql(path);
    return path.type === "predicate" ? serialized : `(${serialized})`;
}
