import { Localized } from '@fluent/react'
import { ReactNode, useContext, useState } from 'react'
import { languageContext } from '../../core/language-context'
import { mainContext } from '../../core/main-context'
import { addIcon, dismissIcon } from '../../helpers/icons'
import { MemoIcon } from '../various/Icon'
import AddLanguage from './AddLanguage'
import InterfaceLanguagePicker from './InterfaceLanguagePicker'

type Props = {
  children: ReactNode
}

export default function LanguageAwareTabs({ children }: Props) {
  const { interfaceLanguages, data, languageMode } = useContext(mainContext)
  const [isCreatingLanguage, setIsCreatingLanguage] = useState(false)

  const {
    activeInterfaceLanguage,
    usedLanguageCodes,
    activeContentLanguage,
    setActiveContentLanguage,
    languages,
    setLanguages
  } = useContext(languageContext)
  const localAllowedLanguages = { ...languages }

  for (const usedLanguageCode of usedLanguageCodes) {
    if (!(usedLanguageCode in localAllowedLanguages))
      localAllowedLanguages[usedLanguageCode] = {
        [usedLanguageCode]: usedLanguageCode
      }
  }

  const showInterfaceLanguageSwitcher = Object.keys(interfaceLanguages).length > 1
  const showContentLanguageSwitcher = languageMode === 'tabs' && Object.keys(localAllowedLanguages).length > 1

  return !showInterfaceLanguageSwitcher && !showContentLanguageSwitcher ? (
    children
  ) : (
    <>
      <div className="languages">
        {Object.keys(localAllowedLanguages).length && languageMode === 'tabs' ? (
          <>
            {Object.entries(localAllowedLanguages).map(([languageCode, label]) => (
              <button
                key={languageCode}
                onClick={() => setActiveContentLanguage(languageCode)}
                className={`language-button ${activeContentLanguage === languageCode ? 'active' : ''}`}
              >
                {label[activeInterfaceLanguage] ?? languageCode}
                {Object.keys(localAllowedLanguages).length > 1 ? (
                  <span
                    onClick={event => {
                      event.stopPropagation()
                      const languagesCopy = { ...languages }
                      delete languagesCopy[languageCode]
                      const nextActiveContentLanguage = Object.keys(languagesCopy)[0]
                      for (const quad of [...data]) {
                        if (quad.object.termType === 'Literal' && quad.object.language === languageCode) {
                          data.delete(quad)
                        }
                      }
                      setLanguages(languagesCopy)
                      setActiveContentLanguage(nextActiveContentLanguage)
                    }}
                    className="remove-language"
                  >
                    <MemoIcon icon={dismissIcon} />
                  </span>
                ) : null}
              </button>
            ))}
            {isCreatingLanguage ? (
              <AddLanguage
                callback={(language?: { labels: Record<string, string>; code: string }) => {
                  setIsCreatingLanguage(false)
                  if (language) {
                    setLanguages({ ...languages, [language.code]: language.labels })
                    setActiveContentLanguage(language.code)
                  }
                }}
              />
            ) : null}
            <button
              className={`add-language button outline secondary small ${
                Object.keys(interfaceLanguages).length <= 1 ? 'end' : ''
              }`}
              onClick={() => setIsCreatingLanguage(true)}
            >
              <MemoIcon icon={addIcon} />
              <Localized id="add-language">Add language</Localized>
            </button>
          </>
        ) : null}

        <InterfaceLanguagePicker />
      </div>
      {children}
    </>
  )
}
