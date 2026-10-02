import type { Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { st } from "@/helpers/namespaces.ts";

/**
 * Every `st:cssImport <URL>` declared directly on any of `nodeShapes` (see the "ShapeThing
 * Vocabulary" living doc) - a shape-author escape hatch for one-off presentational CSS (e.g.
 * styling a specific sh:PropertyGroup's own `data-iri`) that doesn't belong in this package's
 * bundled theme. A relative `<./foo.css>` in the shapes graph's source Turtle is already an
 * absolute URL by the time it reaches here - resolveRdfSources.ts parses with the fetched
 * document's own URL as baseIRI - so no base-IRI handling is needed.
 *
 * Collected across every entry in `nodeShapes` (not just the first match), since sh:and/multiple
 * targetClass matches, or (in facet mode) several active root shapes, may each contribute their
 * own stylesheet - deduped by URL but otherwise kept in `nodeShapes`' own order, so a later
 * shape's rules can override an earlier one's once both are loaded (later `<link>` wins the
 * cascade).
 */
export function cssImportsForShapes(
  nodeShapes: Iterable<Quad_Subject>,
  shapesGraph: RdfStore,
): string[] {
  const seen = new Set<string>();
  for (const node of nodeShapes) {
    for (const quad of shapesGraph.getQuads(node, st("cssImport"))) {
      if (quad.object.termType === "NamedNode") seen.add(quad.object.value);
    }
  }
  return [...seen];
}
