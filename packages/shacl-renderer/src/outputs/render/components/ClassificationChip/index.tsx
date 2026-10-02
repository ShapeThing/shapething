import type { Term } from "@rdfjs/types";
import { stringToGradient } from "string-to-color-gradient";
import ValueChip from "@/outputs/render/components/ValueChip/index.tsx";

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
