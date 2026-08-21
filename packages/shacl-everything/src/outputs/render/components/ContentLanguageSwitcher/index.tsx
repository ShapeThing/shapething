import { useId, useMemo, useState } from "react";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import CreateLanguageModal from "@/outputs/render/components/ContentLanguageSwitcher/CreateLanguageModal.tsx";
import DeleteLanguageModal from "@/outputs/render/components/ContentLanguageSwitcher/DeleteLanguageModal.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { languageLabels } from "@/helpers/languageLabels.ts";
import { deleteLiteralsByLanguage } from "@/helpers/deleteLiteralsByLanguage.ts";
import { Delete } from "@/helpers/icons.tsx";
import type { BCP47 } from "@/types/BCP47.ts";
import { Localized } from "@fluent/react";
import "./style.css";

export default function ContentLanguageSwitcher() {
  const { languageMode, enableContentLanguageCreation, enableFullLanguageRemoval, dataGraph } =
    useEnvironment();
  const { languages, activeLanguage, setActiveLanguage, removeLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [languageToDelete, setLanguageToDelete] = useState<BCP47>();
  const triggerId = useId();

  // Content values are in all sorts of languages - but the picker naming them is chrome, so it
  // reads in whichever language the interface itself is currently in (unlike the interface
  // language switcher, which always shows autonyms - see languageLabels).
  const labels = useMemo(
    () => languageLabels(languages, activeInterfaceLanguage),
    [languages, activeInterfaceLanguage],
  );

  // In "individual" mode every translation renders side by side, each with its own per-value
  // language <select> (see TextFieldWithLangEditor/TextAreaWithLangEditor) - there is nothing
  // for a single global switcher to pick between, and nowhere for a newly created language to be
  // shown either, so the whole thing (switcher and creation) stays hidden.
  const enabled = languageMode !== "individual";
  const showCreateOption = enabled && Boolean(enableContentLanguageCreation);
  // The dropdown is worth showing even with only one language, as long as it can grow via the
  // "add language" row below - otherwise there'd be nowhere to trigger creation from at all.
  const showSelect = enabled && (languages.length > 1 || showCreateOption);

  if (!showSelect) return null;

  return (
    <>
      <FormElement
        className="st-content-language-switcher"
        label={<Localized id="content-language-switcher-label">Content language</Localized>}
        tooltip={<Localized id="content-language-switcher-tooltip" />}
        htmlFor={triggerId}
      >
        <SelectListbox
          triggerId={triggerId}
          value={activeLanguage}
          options={languages}
          onChange={setActiveLanguage}
          classPrefix="st-content-language-switcher"
          renderTriggerContent={(language) => (
            <span className="st-content-language-switcher__option-label">
              {labels[language] ?? language}
            </span>
          )}
          renderOption={(language, close) => (
            <>
              <span className="st-content-language-switcher__option-label">
                {labels[language]}
              </span>
              {enableFullLanguageRemoval && (
                <Localized
                  id="content-language-delete-option"
                  vars={{ language: labels[language] ?? language }}
                  attrs={{ "aria-label": true }}
                >
                  <button
                    type="button"
                    // Reachable by mouse only (see the trigger's Delete-key handling above) -
                    // a real focusable button nested inside a row would otherwise stop Tab
                    // here instead of leaving the listbox in one hop, breaking the roving,
                    // aria-activedescendant-driven focus model the rest of this listbox uses.
                    tabIndex={-1}
                    className="st-content-language-switcher__delete"
                    aria-label="Delete language content"
                    onClick={(event) => {
                      // Deleting is a distinct action from picking this row as the active
                      // language - stop it from also bubbling into the row's own onClick above.
                      event.stopPropagation();
                      setLanguageToDelete(language);
                      close();
                    }}
                  >
                    <Delete />
                  </button>
                </Localized>
              )}
            </>
          )}
          extraRow={
            showCreateOption
              ? {
                  content: (
                    <Localized id="content-language-create-option">Add language…</Localized>
                  ),
                  onActivate: () => setCreateModalOpen(true),
                }
              : undefined
          }
          onDeleteKey={(language) => setLanguageToDelete(language)}
        />
      </FormElement>
      {showCreateOption && (
        <CreateLanguageModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      )}
      <DeleteLanguageModal
        language={languageToDelete}
        label={languageToDelete ? labels[languageToDelete] : undefined}
        onCancel={() => setLanguageToDelete(undefined)}
        onConfirm={() => {
          if (languageToDelete) {
            deleteLiteralsByLanguage(dataGraph, languageToDelete);
            removeLanguage(languageToDelete);
          }
          setLanguageToDelete(undefined);
        }}
      />
    </>
  );
}

