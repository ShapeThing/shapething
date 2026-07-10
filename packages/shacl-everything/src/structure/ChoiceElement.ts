import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { getRdfList } from "@/helpers/rdfList.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { propertiesForShape } from "@/structure/propertiesForShape.ts";

export type ChoiceConnective = "or" | "xone";

export const CHOICE_CONNECTIVES: ChoiceConnective[] = ["or", "xone"];

export class ChoiceElement {
  public shapesGraph: RdfStore;
  public dataGraph: RdfStore;
  public shape: Term;
  public connective: ChoiceConnective;
  public list: Term;

  constructor(
    shapesGraph: RdfStore,
    dataGraph: RdfStore,
    shape: Term,
    connective: ChoiceConnective,
    list: Term,
  ) {
    this.shapesGraph = shapesGraph;
    this.dataGraph = dataGraph;
    this.shape = shape;
    this.connective = connective;
    this.list = list;
  }

  children(): PropertyUIElement[][] {
    return getRdfList(this.list, this.shapesGraph).map((branchShape) =>
      propertiesForShape(this.shapesGraph, this.dataGraph, branchShape),
    );
  }
}
