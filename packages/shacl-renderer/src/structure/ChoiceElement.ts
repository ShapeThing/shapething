import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { getRdfList } from "@/helpers/rdfList.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Widgets } from "@/widgets/types.ts";
import type { ChoiceConnective } from "@/structure/shapeComposition.ts";

export { CHOICE_CONNECTIVES, type ChoiceConnective } from "@/structure/shapeComposition.ts";

export type ChoiceElementOptions = {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph: RdfStore;
  widgetRegistry: Widgets;
  focusNode: Quad_Subject;
  shape: Term;
  connective: ChoiceConnective;
  list: Term;
  ancestorPath: string[];
  // Expands one branch shape at this element's own focus node - childrenForShape passes itself in
  // here, so this module never imports childrenForShape back (which constructs ChoiceElements).
  expandBranch: (branchShape: Term) => (PropertyUIElement | ChoiceElement)[];
};

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
  public ancestorPath: string[];
  #expandBranch: ChoiceElementOptions["expandBranch"];
  #children: (PropertyUIElement | ChoiceElement)[][] | undefined;

  constructor(options: ChoiceElementOptions) {
    this.shapesGraph = options.shapesGraph;
    this.dataGraph = options.dataGraph;
    this.scoresGraph = options.scoresGraph;
    this.widgetRegistry = options.widgetRegistry;
    this.focusNode = options.focusNode;
    this.shape = options.shape;
    this.connective = options.connective;
    this.list = options.list;
    this.ancestorPath = options.ancestorPath;
    this.#expandBranch = options.expandBranch;
  }

  /**
   * Every branch's children, eagerly (not just the active branch's) - see ChoiceElementComponent.
   * Purely shapes-graph-derived, so computed once per instance and handed back as the same arrays
   * (of the same, themselves-memoized elements) on every later call; which branch is *active* is
   * a data question answered separately (choiceBranches.ts's detectActiveChoiceBranch).
   */
  children(): (PropertyUIElement | ChoiceElement)[][] {
    this.#children ??= getRdfList(this.list, this.shapesGraph).map((branchShape) =>
      this.#expandBranch(branchShape)
    );
    return this.#children;
  }
}
