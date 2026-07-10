import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { termKey } from "@/helpers/termKey.ts";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

/**
 * Walks a parsed SHACL property path from `focusNode` through `dataGraph`, returning every term
 * reachable at the end of the path - the actual value(s) this property currently holds, as
 * opposed to `toSparql`/`toGrapoi` which only describe the path itself without executing it.
 */
export function walkPropertyPath(path: PropertyPath, focusNode: Term, dataGraph: RdfStore): Term[] {
  return dedupe(step(path, [focusNode], dataGraph, false));
}

// `inverse` tracks whether the current subtree is being traversed backwards - it flips on every
// nested sh:inversePath (so an inverse of an inverse is forwards again) and, for a sequence,
// additionally reverses step order (the inverse of a/b is ^b/^a, not ^a/^b).
function step(path: PropertyPath, nodes: Term[], dataGraph: RdfStore, inverse: boolean): Term[] {
  switch (path.type) {
    case "predicate":
      return dedupe(
        nodes.flatMap((node) =>
          inverse
            ? dataGraph.getQuads(null, path.predicate, node).map((quad) => quad.subject)
            : dataGraph.getQuads(node, path.predicate).map((quad) => quad.object),
        ),
      );

    case "sequence": {
      const items = inverse ? [...path.items].reverse() : path.items;
      return items.reduce((current, item) => step(item, current, dataGraph, inverse), nodes);
    }

    case "alternative":
      return dedupe(path.items.flatMap((item) => step(item, nodes, dataGraph, inverse)));

    case "inverse":
      return step(path.path, nodes, dataGraph, !inverse);

    case "zeroOrMore":
      return closure(path.path, nodes, dataGraph, inverse, nodes);

    case "oneOrMore": {
      const first = step(path.path, nodes, dataGraph, inverse);
      return closure(path.path, first, dataGraph, inverse, first);
    }

    case "zeroOrOne":
      return dedupe([...nodes, ...step(path.path, nodes, dataGraph, inverse)]);
  }
}

// Repeatedly applies `path` starting from `frontier`, accumulating every newly reached term into
// `seed` (already holding the zero-step nodes for zeroOrMore, or the one-step nodes for
// oneOrMore), until a round finds nothing new. The visited set is what keeps cyclical data (e.g.
// ex:a ex:knows ex:b, ex:b ex:knows ex:a) from looping forever.
function closure(
  path: PropertyPath,
  frontier: Term[],
  dataGraph: RdfStore,
  inverse: boolean,
  seed: Term[],
): Term[] {
  const result = dedupe(seed);
  const seen = new Set(result.map(termKey));
  let current = dedupe(frontier);

  while (current.length > 0) {
    const next = step(path, current, dataGraph, inverse).filter((term) => !seen.has(termKey(term)));
    for (const term of next) seen.add(termKey(term));
    result.push(...next);
    current = next;
  }

  return result;
}

function dedupe(terms: Term[]): Term[] {
  const seen = new Map<string, Term>();
  for (const term of terms) {
    if (!seen.has(termKey(term))) seen.set(termKey(term), term);
  }
  return [...seen.values()];
}
