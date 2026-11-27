import type { NamedNode, Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { rdf } from "@/helpers/namespaces.ts";
import type { Preprocessor } from "@/preprocess/index.ts";
import { getReadOnlyGraphs } from "@/resolution/globalConfiguration.ts";
import { targetClassOf } from "@/structure/targetClassTypes.ts";

// Adds two kinds of triples to Environment.readOnlyGraph (alongside whatever the caller already
// supplied there), so the existing read-only handling - viewer instead of editor, no remove
// control, see PropertyUIElement.isReadOnly() - applies to them as well:
//
// - shui:readOnlyGraph (3.4): every dataGraph triple in one of the configured named graphs.
// - In edit mode, the focus node's rdf:type of each root node shape's class target (see
//   structure/targetClassTypes.ts, which seeds that type into a new resource). Removing it would
//   take the resource out of the very shape it is edited through.
//
// Runs before resolveScoresGraph, which only adds the viewer scoring rules edit mode then needs
// when readOnlyGraph is set.
export const resolveReadOnlyGraphs: Preprocessor = (environment) => {
  const { shapesGraph, dataGraph, readOnlyGraph } = environment;
  if (!(shapesGraph instanceof RdfStore) || !(dataGraph instanceof RdfStore)) return environment;

  const quads: Quad[] = [];
  for (const graph of getReadOnlyGraphs(shapesGraph)) {
    quads.push(...dataGraph.getQuads(null, null, null, graph));
  }
  if (environment.mode === "edit" && environment.focusNode) {
    const { focusNode } = environment;
    for (const shape of environment.nodeShapes ?? []) {
      const classTerm: NamedNode | undefined = targetClassOf(shape, shapesGraph);
      if (classTerm) quads.push(factory.quad(focusNode, rdf("type"), classTerm));
    }
  }
  if (quads.length === 0) return environment;

  const merged = RdfStore.createDefault();
  if (readOnlyGraph instanceof RdfStore) {
    for (const quad of readOnlyGraph.getQuads()) merged.addQuad(quad);
  }
  for (const quad of quads) merged.addQuad(quad);
  return { ...environment, readOnlyGraph: merged };
};
