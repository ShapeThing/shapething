import { useMemo, useState } from "react";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import CreateLanguageModal from "@/outputs/render/components/CreateLanguageModal/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { languageLabels } from "@/helpers/languageLabels.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import { Localized } from "@fluent/react";
import "./style.css";

type Props = {
  ariaLabelledby?: string;
  // The value's current language. Callers get this straight off an RDF/JS Literal's .language
  // (typed as a bare string by rdfjs, and empty when the literal has no language tag yet) or a
  // shape's sh:languageIn - cast at the call site, after falling back to some non-empty language
  // (e.g. the active content language) so this is never asked to display "no language".
  value: BCP47;
  // Languages declared for this value (e.g. shape.get(sh("languageIn"))) - may be empty when the
  // shape declares no sh:languageIn at all, in which case "Add language…" (see below) is the only
  // way to give the value a language.
  options: BCP47[];
  onChange: (language: BCP47) => void;
};

// A single value's own inline language picker - used by *WithLangEditor widgets when
// Environment.languageMode is "individual" (every translation renders side by side, each with
// its own picker, rather than one global ContentLanguageSwitcher). Mirrors that global switcher's
// "Add language…" flow so a language missing from the shape's sh:languageIn can still be reached,
// gated behind the same enableContentLanguageCreation flag.
export default function ValueLanguageSelect({ ariaLabelledby, value, options, onChange }: Props) {
  const { enableContentLanguageCreation, languageMode } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  // Languages added at runtime via the modal below - kept local to this one value's picker rather
  // than shared with sibling values of the same property, since nothing else in this widget tree
  // shares state across sibling values either (each is its own independent PropertyUIComponentObject).
  const [addedLanguages, setAddedLanguages] = useState<BCP47[]>([]);

  const languages = useMemo(() => {
    const merged = [...options];
    for (const language of addedLanguages) if (!merged.includes(language)) merged.push(language);
    if (!merged.includes(value)) merged.push(value);
    return merged;
  }, [options, addedLanguages, value]);

  // Reads in the interface language, same as ContentLanguageSwitcher - the picker naming these
  // languages is chrome, not content, even though it lives right next to the content it labels.
  const labels = useMemo(
    () => languageLabels(languages, activeInterfaceLanguage),
    [languages, activeInterfaceLanguage],
  );

  const showCreateOption = Boolean(enableContentLanguageCreation);

  return (
    languageMode === "individual" && (
      <>
        <SelectListbox
          ariaLabelledby={ariaLabelledby}
          value={value}
          options={languages}
          onChange={onChange}
          renderTriggerContent={(v) => labels[v] ?? v}
          renderOption={(v) => labels[v] ?? v}
          wrapperClassName="st-value-language-select"
          extraRow={
            showCreateOption
              ? {
                  content: <Localized id="content-language-create-option">Add language…</Localized>,
                  onActivate: () => setCreateModalOpen(true),
                }
              : undefined
          }
        />
        {/* Mounted only while open, unlike ContentLanguageSwitcher's single global instance - one of
          these exists per value, so leaving it always-mounted would litter every value's own DOM
          subtree with a hidden dialog + form, colliding with anything that queries a value's
          widget wrapper for its own input (e.g. ".st-property-object__widget input.st-input"). */}
        {createModalOpen && (
          <CreateLanguageModal
            open
            onClose={() => setCreateModalOpen(false)}
            languages={languages}
            onAdd={(language) => {
              setAddedLanguages((current) =>
                current.includes(language) ? current : [...current, language],
              );
              onChange(language);
            }}
          />
        )}
      </>
    )
  );
}
