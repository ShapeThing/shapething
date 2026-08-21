import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";

export default function TextFieldWithLangEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
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
        aria-labelledby={labelledBy}
      />
      {languageMode === "individual" && languages.length > 0 && (
        <SelectListbox
          ariaLabelledby={labelledBy}
          value={language}
          options={languages.map((l) => l.value)}
          onChange={(v) => setTerm(factory.literal(term.value, v))}
          renderTriggerContent={(v) => v}
          renderOption={(v) => v}
          wrapperClassName="st-select-wrapper-small"
        />
      )}
    </>
  );
}
