import { Localized } from "@fluent/react";
import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { localName } from "@/helpers/localName.ts";
import { sh, shui } from "@/helpers/namespaces.ts";
import { useActiveBranch } from "@/outputs/render/hooks/useActiveBranch.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { logicalBranches, withBranch } from "@/structure/logicalBranches.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import { coerceTermToBranch } from "@/widgets/defaultTerm.ts";

type Props = {
  shape: PropertyUIElement;
  term: Term;
  setTerm: (newTerm: Term) => void;
};

export default function LogicalConstraintSwitcher({ shape, term, setTerm }: Props) {
  const { contentLanguage } = useEnvironment();
  const branches = logicalBranches(shape);
  const activeBranch = useActiveBranch(shape, term, branches);

  if (branches.length === 0) return null;

  const handleChange = async (branchShapeValue: string) => {
    const branch = branches.find(({ shape: branchShape }) => branchShape.value === branchShapeValue);
    if (!branch) return;

    const branchProperty = withBranch(shape, branch.shape);
    const widget = await branchProperty.widget({ widgetPredicate: shui("editor") });
    if (!widget || widget.termType !== "NamedNode") return;

    setTerm(coerceTermToBranch(term, widget, branchProperty, { contentLanguage }));
  };

  return (
    <div className="st-logical-constraint-switcher">
      <label className="st-label">
        <Localized id="logical-constraint-switcher-label">Pick an option</Localized>
      </label>
      <span className="st-select-wrapper st-select-wrapper-small">
        <select
          className="st-select"
          value={activeBranch?.shape.value ?? ""}
          onChange={(e) => {
            handleChange(e.target.value);
          }}
        >
          {branches.map(({ shape: branchShape }) => (
            <option key={branchShape.value} value={branchShape.value}>
              {branchLabel(branchShape, shape.shapesGraph, [contentLanguage])}
            </option>
          ))}
        </select>
        <span className="st-select-arrow" aria-hidden="true" />
      </span>
    </div>
  );
}

// Branches are constraint-only shape nodes, not PropertyUIElements, so their sh:name is read
// straight off shapesGraph rather than through PropertyUIElement.getOne() (which would resolve
// the outer property's own sh:name instead, once merged in via withBranch()).
function branchLabel(branchShape: Term, shapesGraph: RdfStore, languages: BCP47[]): string {
  const names = shapesGraph.getQuads(branchShape, sh("name")).map((quad) => quad.object);
  const best = names.length > 0 ? bestByLanguage(names, languages) : undefined;
  if (best) return best.value;

  return (
    localName(shapesGraph.getQuads(branchShape, sh("datatype"))[0]?.object) ??
    localName(shapesGraph.getQuads(branchShape, sh("class"))[0]?.object) ??
    localName(shapesGraph.getQuads(branchShape, sh("node"))[0]?.object) ??
    branchShape.value
  );
}
