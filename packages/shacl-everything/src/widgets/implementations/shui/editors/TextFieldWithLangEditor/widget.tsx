import { sh } from "@/helpers/namespaces.ts";
import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function TextFieldWithLangEditor({ shape: node }: ObjectWidgetProps) {
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
