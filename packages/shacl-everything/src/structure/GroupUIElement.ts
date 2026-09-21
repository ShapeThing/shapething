import type { Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { hslToHex } from "@/helpers/colorBuckets.ts";
import { st } from "@/helpers/namespaces.ts";
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
  label(languages?: BCP47[]): string | undefined {
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

  /**
   * This group's own st:icon value, if declared - either an Iconify icon name (a literal typed
   * with the iconifyDatatype sentinel, see namespaces.ts) or a plain image IRI/URL literal, left
   * for the caller to distinguish. Not part of the SHACL/SHACL-UI spec; a ShapeThing-original
   * group metadata convention (currently consumed by st:VerticalTabbedPropertyGroup's tab nav).
   */
  icon(): Term | undefined {
    return this.shapesGraph.getQuads(this.node, st("icon"), null)[0]?.object;
  }

  /**
   * This group's own st:color value, if declared - a blank node carrying st:hue/st:saturation/
   * st:lightness sibling triples in shapesGraph (genuine CSS HSL notation, same convention
   * st:ColorEditor/st:ColorViewer use for a property's own value, see helpers/colorBuckets.ts's
   * Hsl type), just declared as shape metadata here instead of a data-graph value - same
   * ShapeThing-original, out-of-spec status as icon() above. Returns a hex string, ready to use as
   * a CSS color directly, or undefined if not declared (or incomplete).
   */
  color(): string | undefined {
    const colorNode = this.shapesGraph.getQuads(this.node, st("color"), null)[0]?.object as
      | Quad_Subject
      | undefined;
    if (!colorNode) return undefined;
    const read = (predicate: ReturnType<typeof st>) =>
      this.shapesGraph.getQuads(colorNode, predicate)[0]?.object.value;
    const h = read(st("hue"));
    const s = read(st("saturation"));
    const l = read(st("lightness"));
    if (h === undefined || s === undefined || l === undefined) return undefined;
    return hslToHex({ h: parseFloat(h), s: parseFloat(s), l: parseFloat(l) });
  }
}
