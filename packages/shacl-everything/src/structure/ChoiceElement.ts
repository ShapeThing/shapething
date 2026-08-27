import type { Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { getRdfList } from "@/helpers/rdfList.ts";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { defaultWidgets } from "@/widgets/registry.ts";
import type { Widgets } from "@/widgets/types.ts";

export type ChoiceConnective = "or" | "xone";

export const CHOICE_CONNECTIVES: ChoiceConnective[] = ["or", "xone"];

export class ChoiceElement {
  // See PropertyUIElement.kind: a tag survives HMR module reloads where `instanceof` doesn't.
  public readonly kind = "choice" as const;
  public shapesGraph: RdfStore;
  public dataGraph: RdfStore;
  public scoresGraph: RdfStore;
  public widgetRegistry: Widgets;
  public focusNode: Quad_Subject;
  public shape: Term;
  public connective: ChoiceConnective;
  public list: Term;

  constructor(
    shapesGraph: RdfStore,
    dataGraph: RdfStore,
    focusNode: Quad_Subject,
    shape: Term,
    connective: ChoiceConnective,
    list: Term,
    scoresGraph?: RdfStore,
    widgetRegistry?: Widgets,
  ) {
    this.shapesGraph = shapesGraph;
    this.dataGraph = dataGraph;
    this.scoresGraph = scoresGraph ?? RdfStore.createDefault();
    this.widgetRegistry = widgetRegistry ?? defaultWidgets;
    this.focusNode = focusNode;
    this.shape = shape;
    this.connective = connective;
    this.list = list;
  }

  children(): (PropertyUIElement | ChoiceElement)[][] {
    return getRdfList(this.list, this.shapesGraph).map((branchShape) =>
      childrenForShape(
        this.shapesGraph,
        this.dataGraph,
        branchShape,
        this.focusNode,
        this.scoresGraph,
        this.widgetRegistry,
      ),
    );
  }
}
