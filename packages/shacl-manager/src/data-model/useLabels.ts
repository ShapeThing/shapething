import type { Term } from "@rdfjs/types";
import { useMemo } from "react";
import { useInterfaceLanguage } from "@/app/useInterfaceLanguage.tsx";
import { useSelect } from "@/data-model/useSelect.ts";
import { buildLabelIndex, displayLabel, labelOf } from "@/data-model/labels.ts";
import labelsQuery from "@/data-model/labels.rq";

export function useLabels() {
  const rows = useSelect(labelsQuery);
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const index = useMemo(() => buildLabelIndex(rows), [rows]);

  return useMemo(
    () => ({
      labelOf: (term: Term) => labelOf(index, term, activeInterfaceLanguage),
      display: (term: Term) => displayLabel(index, term, activeInterfaceLanguage),
    }),
    [index, activeInterfaceLanguage],
  );
}
