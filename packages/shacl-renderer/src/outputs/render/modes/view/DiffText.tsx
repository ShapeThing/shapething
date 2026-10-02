import { useMemo } from "react";
import type { Literal } from "@rdfjs/types";
import { languageLabels } from "@/helpers/languageLabels.ts";
import { textDiff } from "@/helpers/textDiff.ts";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { literalLanguage } from "@/helpers/parseBCP47.ts";

/**
 * One text value that was edited (see propertyDiff.ts's changedText): the new text, with what was
 * removed and added marked inline as <del>/<ins>. A language-tagged value keeps its language label,
 * as LangStringViewer shows it.
 */
export default function DiffText({ removed, added }: { removed: Literal; added: Literal }) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const segments = useMemo(() => textDiff(removed.value, added.value), [removed.value, added.value]);
  const lang = literalLanguage(added);
  const label = lang ? languageLabels([lang], activeInterfaceLanguage)[lang] : undefined;

  return (
    <span className="st-diff-text">
      {segments.map((segment, index) =>
        segment.type === "removed" ? (
          <del key={index} className="st-diff-text__removed">
            {segment.text}
          </del>
        ) : segment.type === "added" ? (
          <ins key={index} className="st-diff-text__added">
            {segment.text}
          </ins>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
      {label && <span className="st-lang-string-viewer__lang">&nbsp;{label}</span>}
    </span>
  );
}
