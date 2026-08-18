import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { languageLabels } from "@/helpers/languageLabels.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import { Localized } from "@fluent/react";

export default function InterfaceLanguageSwitcher() {
  const { activeInterfaceLanguage, setActiveInterfaceLanguage } = useInterfaceLanguage();
  // Every switchable interface language: the shipped/overridden .ftl locales unioned with every
  // language tag found on sh:name/sh:description in shapesGraph - see preprocess/languages.ts.
  const { interfaceLanguages } = useEnvironment();
  const interfaceLanguageLabels = languageLabels(interfaceLanguages);

  return interfaceLanguages.length > 1 ? (
    <FormElement
      className="st-interface-language-switcher"
      label={<Localized id="interface-language-switcher-label">Interface language</Localized>}
      tooltip={<Localized id="interface-language-switcher-tooltip" />}
    >
      <div className="st-select-wrapper">
        <select
          className="st-select"
          value={activeInterfaceLanguage}
          onChange={(e) => setActiveInterfaceLanguage(e.target.value as BCP47)}
        >
          {interfaceLanguages.map((language) => (
            <option key={language} value={language}>
              {interfaceLanguageLabels[language]}
            </option>
          ))}
        </select>
        <span className="st-select-arrow" aria-hidden="true" />
      </div>
    </FormElement>
  ) : null;
}
