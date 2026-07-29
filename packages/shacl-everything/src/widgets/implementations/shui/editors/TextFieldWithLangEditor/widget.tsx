import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";

export default function TextFieldWithLangEditor({ shape, term, setTerm }: WidgetProps) {
  const languages = shape.get(sh("languageIn"));

  return (
    <>
      <input
        type="text"
        className="st-input"
        value={term.value}
        onChange={(e) => setTerm(factory.literal(e.target.value))}
      />
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
