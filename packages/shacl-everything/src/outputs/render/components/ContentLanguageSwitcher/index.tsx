import { useMemo, useState } from "react";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import Tooltip from "@/outputs/render/components/Tooltip/index.tsx";
import CreateLanguageModal from "@/outputs/render/components/ContentLanguageSwitcher/CreateLanguageModal.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { languageLabels } from "@/helpers/languageLabels.ts";
import { Plus } from "@/helpers/icons.tsx";
import type { BCP47 } from "@/types/BCP47.ts";
import { Localized } from "@fluent/react";

export default function ContentLanguageSwitcher() {
  const { languageMode, enableContentLanguageCreation } = useEnvironment();
  const { languages, activeLanguage, setActiveLanguage } = useContentLanguage();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const [createModalOpen, setCreateModalOpen] = useState(false);
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
  const showSelect = enabled && languages.length > 1;
  const showCreateAction = enabled && Boolean(enableContentLanguageCreation);

  if (!showSelect && !showCreateAction) return null;

  return (
    <>
      <FormElement
        className="st-content-language-switcher"
        label={<Localized id="content-language-switcher-label">Content language</Localized>}
        tooltip={<Localized id="content-language-switcher-tooltip" />}
        actions={
          showCreateAction && (
            <Tooltip bare enabled tip={<Localized id="content-language-create-tooltip" />}>
              <Localized id="content-language-create-open" attrs={{ "aria-label": true }}>
                <button
                  type="button"
                  className="st-button"
                  aria-label="Add content language"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <Plus />
                </button>
              </Localized>
            </Tooltip>
          )
        }
      >
        {showSelect && (
          <div className="st-select-wrapper">
            <select
              className="st-select"
              value={activeLanguage}
              onChange={(e) => setActiveLanguage(e.target.value as BCP47)}
            >
              {languages.map((language) => (
                <option key={language} value={language}>
                  {labels[language]}
                </option>
              ))}
            </select>
            <span className="st-select-arrow" aria-hidden="true" />
          </div>
        )}
      </FormElement>
      {showCreateAction && (
        <CreateLanguageModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      )}
    </>
  );
}
