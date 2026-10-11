import type { Term } from "@rdfjs/types";
import { stringToGradient } from "string-to-color-gradient";
import Tooltip from "@/outputs/render/components/Tooltip/index.tsx";
import ValueChip from "@/outputs/render/components/ValueChip/index.tsx";
import "./style.css";

export type Classification = { term: Term; label: string; color?: string };

type Props = {
  classification: Classification;
  size?: "small" | "medium" | "large";
};

// The one shui:ClassificationRole chip every value display shares (AutoCompleteOption, Teaser,
// LabelViewer). st:ColorRole (classification.color, see resolution/label.ts's valueNodeColor) wins
// when the classification's own class declares one - the hash-derived gradient is only a fallback
// for the (far more common) case where no such role is declared.
export default function ClassificationChip({ classification, size = "small" }: Props) {
  const colors = classification.color
    ? [classification.color]
    : stringToGradient(classification.label, { brightness: "light" });

  return (
    <ValueChip
      colors={colors}
      label={classification.label}
      size={size}
      term={classification.term}
    />
  );
}

// How many ClassificationChips render before the rest collapse into a single "+N" chip.
const VISIBLE_CLASSIFICATIONS = 2;

type ChipsProps = {
  classifications?: Classification[];
  size?: "small" | "medium" | "large";
};

// Every one of a value's shui:ClassificationRole values (see query.ts's toResolvedTerms), sorted by
// label so the same ones always stay visible - past VISIBLE_CLASSIFICATIONS, the rest collapse into
// one "+N" chip whose Tooltip still lists them, so a value in many schemes keeps its row compact.
export function ClassificationChips({ classifications = [], size = "small" }: ChipsProps) {
  const sorted = classifications.toSorted((a, b) => a.label.localeCompare(b.label));
  const visible = sorted.slice(0, VISIBLE_CLASSIFICATIONS);
  const hidden = sorted.slice(VISIBLE_CLASSIFICATIONS);
  const chip = (classification: Classification) => (
    <ClassificationChip
      key={`${classification.term.termType}:${classification.term.value}`}
      classification={classification}
      size={size}
    />
  );

  return (
    <>
      {visible.map(chip)}
      {hidden.length > 0 && (
        <Tooltip
          bare
          enabled
          placement="top"
          className="st-classification-chips__more"
          tip={<span className="st-classification-chips__hidden">{hidden.map(chip)}</span>}
        >
          <span className={`st-value-chip st-value-chip--${size}`}>
            <span className="st-value-chip__label">+{hidden.length}</span>
          </span>
        </Tooltip>
      )}
    </>
  );
}
