import type { Term } from "@rdfjs/types";
import { getRdfList } from "@/helpers/rdfList.ts";
import { validate } from "@/scoring/score.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";

/**
 * The branch shape terms of a node-level sh:or/sh:xone, in list order - unlike
 * structure/logicalBranches.ts's property-level LogicalBranch, there's no per-branch connective to
 * carry: one ChoiceElement instance always has exactly one connective for all its branches.
 */
export function choiceBranchShapes(choiceElement: ChoiceElement): Term[] {
  return getRdfList(choiceElement.list, choiceElement.shapesGraph);
}

/**
 * Which of `branchShapes` the focus node already conforms to - the node-level analogue of
 * logicalBranches.ts's detectActiveBranch(), validating the whole focus node against each branch
 * shape (via validate()) instead of a single property value.
 */
export async function detectActiveChoiceBranch(
  choiceElement: ChoiceElement,
  branchShapes: Term[],
): Promise<Term | undefined> {
  for (const branchShape of branchShapes) {
    const conforms = await validate({
      focusNode: choiceElement.focusNode,
      targetGraph: choiceElement.dataGraph,
      shapeNode: branchShape,
      shapesGraph: choiceElement.shapesGraph,
    });
    if (conforms) return branchShape;
  }
  return undefined;
}
