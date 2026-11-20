import type { BlankNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

// A blank node's label is made up by the parser on every load, so it can't go in a URL. Its
// content can: the id is a hash of its outgoing triples, nested blank nodes (an owl:unionOf list,
// a restriction's class expression) written out in place, so the same data gives the same id on
// every load. Two blank nodes with identical content share an id - they say the same thing - and
// editing a blank node changes its id.

// A blank node's content as one string: its "predicate object" pairs, sorted, with every nested
// blank node replaced by its own content. A blank node already on the path (a cycle) is cut short.
export function describeBlankNode(
  store: RdfStore,
  node: BlankNode,
  path: ReadonlySet<string> = new Set(),
): string {
  if (path.has(node.value)) return "[...]";
  const inner = new Set(path).add(node.value);
  const describe = (term: Term): string => {
    if (term.termType === "BlankNode") return describeBlankNode(store, term, inner);
    if (term.termType === "Literal") {
      const suffix = term.language ? `@${term.language}` : `^^<${term.datatype.value}>`;
      return `${JSON.stringify(term.value)}${suffix}`;
    }
    return `<${term.value}>`;
  };
  const pairs = store
    .getQuads(node)
    .map((quad) => `${describe(quad.predicate)} ${describe(quad.object)}`);
  // A triple stated in several graphs counts once.
  return `[ ${[...new Set(pairs)].sort().join(" ; ")} ]`;
}

// cyrb53: a fast 53-bit string hash. Not cryptographic - it only has to tell blank nodes apart.
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    const char = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Per store: label -> id, filled as ids are asked for, and id -> blank node, built on the first
// lookup by hashing every blank subject once. The store is never mutated in place (a reload makes
// a new one), so neither goes stale.
const ids = new WeakMap<RdfStore, Map<string, string>>();
const byId = new WeakMap<RdfStore, Map<string, BlankNode>>();

export function blankNodeId(store: RdfStore, node: BlankNode): string {
  const known = ids.get(store) ?? new Map<string, string>();
  ids.set(store, known);
  let id = known.get(node.value);
  if (id === undefined) {
    id = hash(describeBlankNode(store, node));
    known.set(node.value, id);
  }
  return id;
}

export function findBlankNode(store: RdfStore, id: string): BlankNode | undefined {
  let nodes = byId.get(store);
  if (!nodes) {
    nodes = new Map();
    for (const { subject } of store.getQuads()) {
      if (subject.termType !== "BlankNode") continue;
      const subjectId = blankNodeId(store, subject);
      // Identical content: the first one stands for all of them.
      if (!nodes.has(subjectId)) nodes.set(subjectId, subject);
    }
    byId.set(store, nodes);
  }
  return nodes.get(id);
}
