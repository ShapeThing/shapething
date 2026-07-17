import { sh } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";

export default function TextFieldWithLangEditor({ shape: node }: WidgetProps) {
  const languages = node.get(sh("languageIn"));

  return (
    <>
      <input type="text" />
      {languages.length > 0 && (
        <select>
          {languages.map((language) => (
            <option key={language.value} value={language.value}>
              {language.value}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
