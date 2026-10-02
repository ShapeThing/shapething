import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { localName } from "@/helpers/localName.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

export const getCodeIdentifier = (shapesGraph: RdfStore, shape: NamedNode): string => {
  return (
    shapesGraph.getQuads(shape, sh("codeIdentifier"))[0]?.object.value ??
    // For property shapes with a predicate path only
    localName(shapesGraph.getQuads(shape, sh("path"))[0]?.object) ??
    // Code identifiers must be stable regardless of the reader's UI language, so sh:name is
    // always resolved in English rather than by whatever languages the current viewer prefers.
    bestByLanguage(
      shapesGraph.getQuads(shape, sh("name")).map((quad) => quad.object),
      ["en"],
    )?.value ??
    localName(shape)
  );
};
