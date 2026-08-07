import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import type { WidgetProps } from "@/widgets/types.ts";

export default function TextFieldWithLangEditor({ shape, term, setTerm }: WidgetProps) {
  const { languageMode } = useEnvironment();
  const languages = shape.get(sh("languageIn"));
  // Only a Literal carries a language tag - this widget is only ever scored in for rdf:langString
  // shapes (see score.ttl), so term is always a Literal in practice, but the type is generic Term.
  const language = term.termType === "Literal" ? term.language : "";

  // Typing must keep the value tagged with its current language - only the language <select>
  // below changes which language a value is tagged with.
  const { localValue, onChange, onBlur } = useDeferredInput(term, (value) =>
    setTerm(factory.literal(value, language)),
  );

  return (
    <>
      <input
        type="text"
        className="st-input"
        value={localValue}
        onChange={onChange}
        onBlur={onBlur}
      />
      {languageMode === "individual" && languages.length > 0 && (
        <span className="st-select-wrapper">
          <select
            className="st-select"
            value={language}
            onChange={(e) => setTerm(factory.literal(term.value, e.target.value))}
          >
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
