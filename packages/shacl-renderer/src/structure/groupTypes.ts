import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { ancestorClasses } from "@/resolution/targets.ts";

// A group node is a sh:PropertyGroup when any of its rdf:types is sh:PropertyGroup or
// (transitively) an rdfs:subClassOf it - so `a st:DrawerPropertyGroup` alone is enough. Every
// bundled group type declares that subclass link in its own meta.ttl, which
// preprocess/shapes.ts's addGroupTypeHierarchy merges into the shapes graph; a shape author can
// add their own group types the same way, right in the shapes graph.

/**
 * `node`'s own rdf:types, then every class those are (transitively) an rdfs:subClassOf of, nearest
 * first - so a more specific group type always comes before the ones it specializes.
 */
export function groupTypes(node: Term, graphs: RdfStore[]): Term[] {
  const seen = new Set<string>();
  const direct: Term[] = [];
  for (const graph of graphs) {
    for (const quad of graph.getQuads(node, rdf("type"))) {
      if (seen.has(termKey(quad.object))) continue;
      seen.add(termKey(quad.object));
      direct.push(quad.object);
    }
  }
  const inherited: Term[] = [];
  for (const type of direct) {
    for (const ancestor of ancestorClasses(type, graphs)) {
      if (seen.has(termKey(ancestor))) continue;
      seen.add(termKey(ancestor));
      inherited.push(ancestor);
    }
  }
  return [...direct, ...inherited];
}

/** Whether `node` is (an instance of a subclass of) `type`, e.g. st:TabbedPropertyGroup. */
export function hasGroupType(node: Term, type: Term, graphs: RdfStore[]): boolean {
  return groupTypes(node, graphs).some((candidate) => candidate.equals(type));
}

/** Whether `node` is a sh:PropertyGroup, directly or through a subclass of it. */
export function isPropertyGroup(node: Term, graphs: RdfStore[]): boolean {
  return hasGroupType(node, sh("PropertyGroup"), graphs);
}
