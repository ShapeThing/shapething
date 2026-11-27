import type { NamedNode } from "@rdfjs/types";
import type { ShaclRendererProps } from "@shapething/shacl-renderer";
import { use, useMemo } from "react";
import { LanguagesContext } from "./termLabel.ts";

// A shapes graph (Turtle) and the root shape in it that a node is shown or edited through.
export type ShapeSource = { shapesGraph: string; nodeShape: NamedNode };

// What every renderer in the manager shares. The shape declares the well-known properties; every
// other predicate is generated into its st:missingPropertiesGroup.
export function useRendererProps({ shapesGraph, nodeShape }: ShapeSource) {
  const nodeShapes = useMemo(() => [nodeShape], [nodeShape]);
  return {
    shapesGraph,
    nodeShapes,
    ...useRendererSettings(),
  } satisfies Partial<ShaclRendererProps>;
}

// The settings without the shapes, for a renderer whose shapes come from elsewhere.
export function useRendererSettings() {
  const [language] = use(LanguagesContext);
  return {
    enableMissingShapesGeneration: true,
    enableInterfaceLanguageSwitcher: false,
    // Show every translation side by side instead of one at a time behind a content language switcher.
    languageMode: "individual",
    // The data model's store already holds every import, loaded through the host's loadGraph.
    enableOwlImports: false,
    enableShPathInLabelTitle: false,
    // The shapes decide each property's widget and branch; the manager offers no switching.
    enableWidgetSwitching: false,
    enableLogicalBranchSwitching: false,
    ...(language && { interfaceLanguage: language, contentLanguage: language }),
  } satisfies Partial<ShaclRendererProps>;
}
