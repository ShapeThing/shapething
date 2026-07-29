import { sh } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";

export default function TextAreaWithLangEditor({ shape: node }: WidgetProps) {
  const languages = node.get(sh("languageIn"));

  return (
    <>
      <textarea />
      {languages.length > 0 && (
        <span className="st-select-wrapper">
          <select className="st-select">
            {languages.map((language) => (
              <option key={language.value} value={language.value}>
                {language.value}
              </option>
            ))}
          </select>
          <span className="st-select-arrow" aria-hidden="true" />
        </span>
      )}
    </>
  );
}
