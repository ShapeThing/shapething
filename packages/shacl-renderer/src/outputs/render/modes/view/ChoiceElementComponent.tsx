import { useMemo } from "react";
import { useActiveChoiceBranch } from "@/outputs/render/hooks/useActiveChoiceBranch.tsx";
import UIElementChildren from "@/outputs/render/modes/view/UIElementChildren.tsx";
import { choiceBranchShapes } from "@/structure/choiceBranches.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";

/**
 * Renders a node-level sh:or/sh:xone read-only: unlike edit mode's ChoiceElementComponent, there
 * is no "Pick an alternative" switcher - a viewer just shows whichever branch the focus node
 * currently conforms to (falling back to the first branch when none conforms yet, e.g. an empty
 * node), since there's no manual override to offer when nothing here can be edited.
 */
export default function ChoiceElementComponent({
  choiceElement,
}: {
  choiceElement: ChoiceElement;
}) {
  const branchShapes = useMemo(() => choiceBranchShapes(choiceElement), [choiceElement]);
  const branches = useMemo(() => choiceElement.children(), [choiceElement]);
  const detectedBranch = useActiveChoiceBranch(choiceElement, branchShapes);

  if (branchShapes.length === 0) return null;

  const activeIndex = detectedBranch
    ? Math.max(
        branchShapes.findIndex((shape) => shape.equals(detectedBranch)),
        0,
      )
    : 0;

  return (
    <div className="st-choice-element">
      <UIElementChildren
        key={branchShapes[activeIndex]?.value ?? activeIndex}
        elements={branches[activeIndex] ?? []}
      />
    </div>
  );
}
