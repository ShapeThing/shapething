import { Localized } from "@fluent/react";
import { useId } from "react";
import type { Term } from "@rdfjs/types";
import { branchLabel } from "@/helpers/branchLabel.ts";
import { shui } from "@/helpers/namespaces.ts";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { logicalBranches, withBranch, type LogicalBranch } from "@/structure/logicalBranches.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { coerceTermToBranch } from "@/widgets/defaultTerm.ts";

type Props = {
  shape: PropertyUIElement;
  term: Term;
  setTerm: (newTerm: Term) => void;
  // Resolved by the parent (see PropertyUIComponentObject) rather than re-derived here, since it
  // stays pinned to whichever branch was last explicitly picked until the data itself conforms to
  // a different one - a plain data-conformance lookup would disagree with what's actually
  // rendered whenever the picked branch's own required fields aren't filled in yet.
  activeBranch: LogicalBranch | undefined;
  onBranchSelected: (branch: LogicalBranch) => void;
};

export default function LogicalConstraintSwitcher({
  shape,
  term,
  setTerm,
  activeBranch,
  onBranchSelected,
}: Props) {
  const { activeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const branches = logicalBranches(shape);
  const selectId = useId();

  if (branches.length === 0) return null;

  const handleChange = async (branchShapeValue: string) => {
    const branch = branches.find(
      ({ shape: branchShape }) => branchShape.value === branchShapeValue,
    );
    if (!branch) return;

    const branchProperty = withBranch(shape, branch.shape);
    const widget = await branchProperty.widget({ widgetPredicate: shui("editor") });
    if (!widget || widget.termType !== "NamedNode") return;

    onBranchSelected(branch);
    setTerm(coerceTermToBranch(term, widget, branchProperty, { contentLanguage: activeLanguage }));
  };

  return (
    <FormElement
      size="small"
      className="st-logical-constraint-switcher"
      label={<Localized id="logical-constraint-switcher-label">Pick an option</Localized>}
      tooltip={<Localized id="logical-constraint-switcher-tooltip" />}
      htmlFor={selectId}
    >
      <span className="st-select-wrapper st-select-wrapper-small">
        <select
          id={selectId}
          className="st-select"
          value={activeBranch?.shape.value ?? ""}
          onChange={(e) => {
            handleChange(e.target.value);
          }}
        >
          {branches.map(({ shape: branchShape }) => (
            <option key={branchShape.value} value={branchShape.value}>
              {branchLabel(branchShape, shape.shapesGraph, [activeInterfaceLanguage])}
            </option>
          ))}
        </select>
        <span className="st-select-arrow" aria-hidden="true" />
      </span>
    </FormElement>
  );
}
