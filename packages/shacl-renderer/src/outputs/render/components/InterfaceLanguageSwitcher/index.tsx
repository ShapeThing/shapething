import { useId } from "react";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { languageLabels } from "@/helpers/languageLabels.ts";
import { Localized } from "@fluent/react";

export default function InterfaceLanguageSwitcher() {
  const { activeInterfaceLanguage, setActiveInterfaceLanguage } = useInterfaceLanguage();
  // Every switchable interface language: the shipped/overridden .ftl locales unioned with every
  // language tag found on sh:name/sh:description in shapesGraph - see preprocess/languages.ts.
  const { interfaceLanguages, languageMode } = useEnvironment();
  const interfaceLanguageLabels = languageLabels(interfaceLanguages);
  const selectId = useId();

  return interfaceLanguages.length > 1 && languageMode === "switcher" ? (
    <FormElement
      className="st-interface-language-switcher"
      label={<Localized id="interface-language-switcher-label">Interface language</Localized>}
      tooltip={<Localized id="interface-language-switcher-tooltip" />}
      htmlFor={selectId}
    >
      <SelectListbox
        triggerId={selectId}
        value={activeInterfaceLanguage}
        options={interfaceLanguages}
        onChange={setActiveInterfaceLanguage}
        renderTriggerContent={(lang) => interfaceLanguageLabels[lang]}
        renderOption={(lang) => interfaceLanguageLabels[lang]}
      />
    </FormElement>
  ) : null;
}
