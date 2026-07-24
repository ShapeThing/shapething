import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { ex } from "@/helpers/namespaces.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import type { RdfSource } from "@/types/RdfSource.ts";

export type Environment = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph: RdfStore;
  focusNode: NamedNode;
  nodeShapes: Quad_Subject[];
  mode: "edit" | "view" | "facet";
  interfaceLanguage: BCP47;
  contentLanguage: BCP47;
};

// What flows through the preprocessor chain before it's fully resolved: the graph fields may
// still be an unparsed/undereferenced RdfSource rather than a ready RdfStore. RdfStore is itself
// a valid RdfSource, so a fully-resolved Environment already satisfies this type - preprocessors
// don't need a different type per stage of the chain.
export type RawEnvironment = Omit<Environment, "shapesGraph" | "dataGraph" | "scoresGraph"> & {
  shapesGraph: RdfSource;
  dataGraph: RdfSource;
  scoresGraph: RdfSource;
};

export const defaultEnvironment: Environment = {
  shapesGraph: RdfStore.createDefault(),
  dataGraph: RdfStore.createDefault(),
  scoresGraph: RdfStore.createDefault(),
  focusNode: ex("focusNode"),
  nodeShapes: [],
  mode: "edit",
  interfaceLanguage: "en-GB",
  contentLanguage: "en-GB",
};
