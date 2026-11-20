import type { NamedNode } from "@rdfjs/types";
import type { ShaclRendererProps } from "@shapething/shacl-renderer";
import { use, useMemo } from "react";
import { LanguagesContext } from "./termLabel.ts";

// A shapes graph (Turtle) and the root shape in it that a node is shown or edited through.
export type ShapeSource = { shapesGraph: string; nodeShape: NamedNode };

// What every renderer in the manager shares. The shape declares the well-known properties; every
// other predicate is generated into its st:missingPropertiesGroup.
export function useRendererProps({ shapesGraph, nodeShape }: ShapeSource) {
  const [language] = use(LanguagesContext);
  const nodeShapes = useMemo(() => [nodeShape], [nodeShape]);
  return {
    shapesGraph,
    nodeShapes,
    enableMissingShapesGeneration: true,
    enableInterfaceLanguageSwitcher: false,
    // The data model's store already holds every import, loaded through the host's loadGraph.
    enableOwlImports: false,
    ...(language && { interfaceLanguage: language, contentLanguage: language }),
  } satisfies Partial<ShaclRendererProps>;
}
