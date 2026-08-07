import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import { localeLoaders } from "@/l10n/locales.ts";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { languageLabels } from "@/helpers/languageLabels.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import { Localized } from "@fluent/react";

const interfaceLanguages = Object.keys(localeLoaders) as BCP47[];
const interfaceLanguageLabels = languageLabels(interfaceLanguages);

export default function InterfaceLanguageSwitcher() {
  const { activeInterfaceLanguage, setActiveInterfaceLanguage } = useInterfaceLanguage();

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
