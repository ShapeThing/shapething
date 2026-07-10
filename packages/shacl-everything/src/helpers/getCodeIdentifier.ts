import { localName } from "@/helpers/localName.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

export const getCodeIdentifier = (shapesGraph: RdfStore, shape: NamedNode): string => {
  return (
    shapesGraph.getQuads(shape, sh("codeIdentifier"))[0]?.object.value ??
    // For property shapes with a predicate path only
    localName(shapesGraph.getQuads(shape, sh("path"))[0]?.object) ??
    // Improve with Grapoi().best(language) for sh:name
    shapesGraph.getQuads(shape, sh("name"))[0]?.object.value ??
    localName(shape)
  );
};
