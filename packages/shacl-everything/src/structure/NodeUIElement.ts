import type { Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { cssImportsForShapes } from "@/resolution/cssImports.ts";
import { groupDescription } from "@/resolution/label.ts";
import { defaultWidgets } from "@/widgets/registry.ts";
import type { Widgets } from "@/widgets/types.ts";
import type { BCP47 } from "@/types/BCP47.ts";

export type NodeUIElementOptions = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph?: RdfStore;
  widgetRegistry?: Widgets;
  focusNode: Quad_Subject;
  nodeShapes: Quad_Subject[];
  // The chain of SPARQL-rendered property paths (toSparql) walked from the Environment's own root
  // focusNode down to *this* node's focusNode - empty at the root, one entry longer each time a
  // widget (DetailsEditor) descends into a nested object's own NodeUIElement. Forwarded onto every
  // PropertyUIElement this node produces (see PropertyUIElement.dataId()) purely so a form-styling
  // consumer can tell apart a path reused at different nesting depths (rdfs:label being the classic
  // case) - nothing else in this codebase reads it.
  ancestorPath?: string[];
};

export class NodeUIElement {
  public shapesGraph: RdfStore;
  public dataGraph: RdfStore;
  public scoresGraph: RdfStore;
  public widgetRegistry: Widgets;
  public focusNode: Quad_Subject;
  public nodeShapes: Quad_Subject[];
  public ancestorPath: string[];

  constructor(options: NodeUIElementOptions) {
    this.shapesGraph = options.shapesGraph;
    this.dataGraph = options.dataGraph;
    this.scoresGraph = options.scoresGraph ?? RdfStore.createDefault();
    this.widgetRegistry = options.widgetRegistry ?? defaultWidgets;
    this.focusNode = options.focusNode;
    this.nodeShapes = options.nodeShapes;
    this.ancestorPath = options.ancestorPath ?? [];
  }

  children(): (PropertyUIElement | ChoiceElement)[] {
    // One call across the whole list (not a flatMap per shape) so property shapes on the same
    // path declared by two different nodeShapes entries - not just the same shape reached twice -
    // still merge into a single PropertyUIElement; see childrenForShape's own doc comment.
    return childrenForShape(
      this.shapesGraph,
      this.dataGraph,
      this.nodeShapes,
      this.focusNode,
      this.scoresGraph,
      this.widgetRegistry,
      this.ancestorPath,
    );
  }

  /**
   * This node's own sh:description (or rdfs:comment, see resolution/label.ts's
   * effectiveDescriptionPredicates), shown once above its rendered fields - the node-shape
   * equivalent of GroupUIElement.description()/PropertyUIElement.description(). When more than one
   * node shape applies to this focus node (sh:and, several sh:targetClass matches, a conforming
   * sh:targetWhere fragment, etc.) the first one - in nodeShapes' own order - that has a
   * description in the active language wins, rather than concatenating every applicable shape's
   * text together.
   */
  description(languages?: BCP47[]): string | undefined {
    for (const node of this.nodeShapes) {
      const description = groupDescription({ node, shapesGraph: this.shapesGraph, languages });
      if (description) return description;
    }
    return undefined;
  }

  /** See resolution/cssImports.ts's cssImportsForShapes - this node's own st:cssImport URLs. */
  cssImports(): string[] {
    return cssImportsForShapes(this.nodeShapes, this.shapesGraph);
  }
}
