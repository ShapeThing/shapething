import { Localized } from "@fluent/react";
import { useId, useMemo, useState } from "react";
import { branchLabel } from "@/helpers/branchLabel.ts";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useActiveChoiceBranch } from "@/outputs/render/hooks/useActiveChoiceBranch.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import UIElementChildren from "@/outputs/render/modes/edit/UIElementChildren.tsx";
import { choiceBranchShapes } from "@/structure/choiceBranches.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import "./style.css";

/**
 * Renders a node-level sh:or/sh:xone: a "Pick an alternative" switcher (the node-level analogue
 * of LogicalConstraintSwitcher, but always visible - unlike a property's value, a branch here
 * isn't tucked into one widget's cramped slot, it sits like a fieldset in the properties list) and
 * the selected branch's own fields underneath. Unlike the property-level switcher, switching
 * branches here is purely a display choice: there's no single term to coerce, and sh:or is
 * inclusive, so a previously-active branch's data is simply left alone when switching away from it.
 */
export default function ChoiceElementComponent({
  choiceElement,
}: {
  choiceElement: ChoiceElement;
}) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const selectId = useId();

  const branchShapes = useMemo(() => choiceBranchShapes(choiceElement), [choiceElement]);
  const branches = useMemo(() => choiceElement.children(), [choiceElement]);
  const detectedBranch = useActiveChoiceBranch(choiceElement, branchShapes);

  // Unlike PropertyUIComponentObject's pinnedBranchKey, a manual pick here is never superseded by
  // detection afterwards: switching branches doesn't touch the data (see class doc above), so the
  // branch the focus node already conformed to before the switch never stops being "detected" -
  // deferring to detectedBranch once a pin exists would just snap the picker straight back. The
  // pin only defers to detection as the initial default, before the user has touched the picker.
  const [pinnedBranchKey, setPinnedBranchKey] = useState<string | undefined>(undefined);

  if (branchShapes.length === 0) return null;

  const activeBranchShape =
    branchShapes.find((shape) => shape.value === pinnedBranchKey) ?? detectedBranch;
  const selectedIndex = activeBranchShape
    ? Math.max(
        branchShapes.findIndex((shape) => shape.equals(activeBranchShape)),
        0,
      )
    : 0;

  return (
    <div className="st-choice-element">
      <FormElement
        className="st-logical-constraint-switcher"
        label={<Localized id="logical-constraint-switcher-label">Pick an option</Localized>}
        tooltip={<Localized id="logical-constraint-switcher-tooltip" />}
        htmlFor={selectId}
      >
        <span className="st-select-wrapper">
          <select
            id={selectId}
            className="st-select"
            value={branchShapes[selectedIndex]?.value ?? ""}
            onChange={(e) => setPinnedBranchKey(e.target.value)}
          >
            {branchShapes.map((branchShape) => (
              <option key={branchShape.value} value={branchShape.value}>
                {branchLabel(branchShape, choiceElement.shapesGraph, [activeInterfaceLanguage])}
              </option>
            ))}
          </select>
          <span className="st-select-arrow" aria-hidden="true" />
        </span>
      </FormElement>
      {/* Keyed on the active branch: switching branches swaps in an entirely different set of
          properties, not just new props for the same ones - without this key, React would reuse
          each position's PropertyUIComponent instance (and its stale internal state, e.g.
          showEmptyWidget) across the swap instead of mounting the new branch's fields fresh. */}
      <UIElementChildren
        key={branchShapes[selectedIndex]?.value ?? selectedIndex}
        elements={branches[selectedIndex] ?? []}
      />
    </div>
  );
}
