import type { BlankNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

// A parser makes up blank node labels on every load, so they can't go in a URL. A hash of the
// node's content can: the same data gives the same id on every load. Nodes with identical content
// are told apart by a suffix (see idsOf), and editing a blank node changes its id.

// Its "predicate object" pairs, sorted, with nested blank nodes written out in place.
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

// Per store, which is never mutated in place, so neither goes stale.
type Ids = { byNode: Map<string, string>; byId: Map<string, BlankNode> };
const idsPerStore = new WeakMap<RdfStore, Ids>();

// Separate nodes with identical content (say two `[ owl:unionOf (A B) ]`, each the domain of other
// properties) are still separate pages: the first keeps the plain hash, the next ones get "-2",
// "-3"… in the order the store lists them, which is the same on every load of the same data.
function idsOf(store: RdfStore): Ids {
  let ids = idsPerStore.get(store);
  if (ids) return ids;
  ids = { byNode: new Map(), byId: new Map() };
  const seen = new Map<string, number>();
  for (const quad of store.getQuads()) {
    for (const term of [quad.subject, quad.object]) {
      if (term.termType !== "BlankNode" || ids.byNode.has(term.value)) continue;
      const base = hash(describeBlankNode(store, term));
      const occurrence = (seen.get(base) ?? 0) + 1;
      seen.set(base, occurrence);
      const id = occurrence === 1 ? base : `${base}-${occurrence}`;
      ids.byNode.set(term.value, id);
      ids.byId.set(id, term);
    }
  }
  idsPerStore.set(store, ids);
  return ids;
}

export function blankNodeId(store: RdfStore, node: BlankNode): string {
  // A node the store doesn't have (anymore) can only go by its content.
  return idsOf(store).byNode.get(node.value) ?? hash(describeBlankNode(store, node));
}

export function findBlankNode(store: RdfStore, id: string): BlankNode | undefined {
  return idsOf(store).byId.get(id);
}
