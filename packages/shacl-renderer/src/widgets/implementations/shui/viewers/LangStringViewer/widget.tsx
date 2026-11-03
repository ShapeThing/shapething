import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { languageLabels } from "@/helpers/languageLabels.ts";
import { literalLanguage } from "@/helpers/parseBCP47.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function LangStringViewer({ term }: WidgetProps) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { languages } = useContentLanguage();
  // The language is only worth showing when the content language switcher offers more than one.
  const lang = languages.length > 1 ? literalLanguage(term) : undefined;
  const label = lang ? languageLabels([lang], activeInterfaceLanguage)[lang] : undefined;

  return (
    <span className="st-lang-string-viewer">
      {term.value}
      {label && <span className="st-lang-string-viewer__lang">&nbsp;{label}</span>}
    </span>
  );
}
