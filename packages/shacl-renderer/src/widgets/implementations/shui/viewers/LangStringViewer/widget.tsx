import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { languageLabels } from "@/helpers/languageLabels.ts";
import { literalLanguage } from "@/helpers/parseBCP47.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function LangStringViewer({ term }: WidgetProps) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const lang = literalLanguage(term);
  const label = lang ? languageLabels([lang], activeInterfaceLanguage)[lang] : undefined;

  return (
    <span className="st-lang-string-viewer">
      {term.value}
      {label && <span className="st-lang-string-viewer__lang">&nbsp;{label}</span>}
    </span>
  );
}
