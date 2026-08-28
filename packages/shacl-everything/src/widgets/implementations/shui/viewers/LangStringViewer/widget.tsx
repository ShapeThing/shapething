import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { languageLabels } from "@/helpers/languageLabels.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function LangStringViewer({ term }: WidgetProps) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const lang = term.termType === "Literal" ? (term.language as BCP47) : "";
  const label = lang ? languageLabels([lang], activeInterfaceLanguage)[lang] : undefined;

  return (
    <span className="st-lang-string-viewer">
      {term.value}
      {label && <span className="st-lang-string-viewer__lang">{label}</span>}
    </span>
  );
}
