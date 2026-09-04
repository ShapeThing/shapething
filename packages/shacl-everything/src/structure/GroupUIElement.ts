import type { Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { groupDescription, groupLabel } from "@/resolution/label.ts";
import { defaultWidgets, getGroupWidget } from "@/widgets/registry.ts";
import type { GroupWidgetRegistryEntry, Widgets } from "@/widgets/types.ts";
import type { BCP47 } from "@/types/BCP47.ts";

export type GroupUIElementOptions = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  widgetRegistry?: Widgets;
  focusNode: Quad_Subject;
  node: Term;
  children: (PropertyUIElement | ChoiceElement | GroupUIElement)[];
};

export class GroupUIElement {
  // See PropertyUIElement.kind: a tag survives HMR module reloads where `instanceof` doesn't.
  public readonly kind = "group" as const;
  public shapesGraph: RdfStore;
  public dataGraph: RdfStore;
  public widgetRegistry: Widgets;
  public focusNode: Quad_Subject;
  public node: Term;
  public children: (PropertyUIElement | ChoiceElement | GroupUIElement)[];

  constructor(options: GroupUIElementOptions) {
    this.shapesGraph = options.shapesGraph;
    this.dataGraph = options.dataGraph;
    this.widgetRegistry = options.widgetRegistry ?? defaultWidgets;
    this.focusNode = options.focusNode;
    this.node = options.node;
    this.children = options.children;
  }

  /**
   * This group's own rdfs:label (per spec 8.7), then sh:name as an out-of-spec fallback (or
   * configured shui:labelPreference), falling back to its local name - a group is shape metadata
   * only, so there are no data-graph label steps to run here (see resolution/label.ts's
   * groupLabel).
   */
  label(languages?: BCP47[]): string {
    return groupLabel({
      node: this.node,
      shapesGraph: this.shapesGraph,
      languages,
    });
  }

  description(languages?: BCP47[]): string | undefined {
    return groupDescription({
      node: this.node,
      shapesGraph: this.shapesGraph,
      languages,
    });
  }

  /**
   * The registered widget for this group's own rdf:type - synchronous, direct type matching, no
   * scoring involved (see widgets/registry.ts's getGroupWidget).
   */
  widget(): GroupWidgetRegistryEntry | undefined {
    return getGroupWidget(this.node, this.shapesGraph, this.widgetRegistry);
  }
}
