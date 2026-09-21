import { Localized } from "@fluent/react";
import { useId } from "react";
import type { NamedNode, Term } from "@rdfjs/types";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { propertyLabel } from "@/resolution/label.ts";
import { prefixedIri } from "@/helpers/prefixedIri.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

type Props = {
  shape: PropertyUIElement;
  term: Term;
  // Which branch the user last explicitly picked via this switcher, kept "pinned" in WidgetSlot for
  // a value that doesn't exist yet (setAlternativePathBranch only moves an already-written triple -
  // there's nothing to move for an empty placeholder field). Superseded the moment the data itself
  // resolves to some branch - see WidgetSlot's own reconciliation effect - so this never overrides
  // real data, mirroring LogicalConstraintSwitcher's identical pinnedBranchKey pattern for sh:or.
  pinnedBranch: NamedNode | undefined;
  onBranchSelected: (branch: NamedNode) => void;
};

export default function AlternativePathSwitcher({
  shape,
  term,
  pinnedBranch,
  onBranchSelected,
}: Props) {
  const { enableAlternativePathSwitching, sourcePrefixes } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const selectId = useId();

  const branches = shape.alternativePathBranches();

  if (!branches || branches.length === 0 || !enableAlternativePathSwitching) return null;

  const activeBranch =
    shape.activeAlternativePathBranch(term) ?? pinnedBranch ?? shape.defaultAlternativePathBranch();
  if (!activeBranch) return null;

  const label = (branchIri: string) => {
    const branch = branches.find((b) => b.value === branchIri) ?? branches[0];
    const text = propertyLabel({ term: branch, propertyShape: shape, languages: [activeInterfaceLanguage] });
    const prefixed = prefixedIri(branch, sourcePrefixes);
    return prefixed ? `${text} (${prefixed})` : text;
  };

  return (
    <FormElement
      size="small"
      className="st-alternative-path-switcher"
      label={<Localized id="alternative-path-switcher-label">Pick where to store this</Localized>}
      tooltip={<Localized id="alternative-path-switcher-tooltip" />}
      htmlFor={selectId}
    >
      <SelectListbox
        triggerId={selectId}
        value={activeBranch.value}
        options={branches.map((branch) => branch.value)}
        onChange={(v) => {
          const branch = branches.find((b) => b.value === v);
          if (!branch) return;

          onBranchSelected(branch);
          if (shape.activeAlternativePathBranch(term)) {
            shape.setAlternativePathBranch(term, branch);
          }
        }}
        renderTriggerContent={label}
        renderOption={label}
        wrapperClassName="st-select-wrapper-small"
      />
    </FormElement>
  );
}
