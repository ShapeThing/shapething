import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import ValueLanguageSelect from "@/outputs/render/components/ValueLanguageSelect/index.tsx";
import type { BCP47 } from "@/types/BCP47.ts";

export default function TextAreaWithLangEditor({
  shape,
  term,
  setTerm,
  labelledBy,
  autoFocus,
}: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const languages = shape.get(sh("languageIn"));
  // Only a Literal carries a language tag - this widget is only ever scored in for rdf:langString
  // shapes (see score.ttl), so term is always a Literal in practice, but the type is generic Term.
  // A Literal can still carry no language tag at all (e.g. a fresh value created before its
  // createTerm ran, or pre-existing data that just never had one) - fall back to the active
  // content language, then to whatever this property's own sh:languageIn offers first, so typing
  // into the field never commits a languageless rdf:langString literal.
  const language =
    (term.termType === "Literal" ? term.language : "") ||
    activeLanguage ||
    languages[0]?.value ||
    "";

  // Typing must keep the value tagged with its current language - only the language <select>
  // below changes which language a value is tagged with.
  const { localValue, onChange, onBlur } = useDeferredInput(term, (value) =>
    setTerm(factory.literal(value, language)),
  );
  const ref = useAutoFocusRef<HTMLTextAreaElement>(autoFocus);

  return (
    <>
      <textarea
        ref={ref}
        className="st-input"
        value={localValue}
        onChange={onChange}
        onBlur={onBlur}
        aria-labelledby={labelledBy}
      >
        {localValue}
      </textarea>
      <ValueLanguageSelect
        ariaLabelledby={labelledBy}
        // sh:languageIn values and a Literal's .language are plain strings by type, but always
        // well-formed BCP47 tags in practice (see the comment on `language` above).
        value={language as BCP47}
        options={languages.map((l) => l.value as BCP47)}
        onChange={(v) => setTerm(factory.literal(term.value, v))}
      />
    </>
  );
}
