import { Term } from '@rdfjs/types'
import { useContext, useState } from 'react'
import { languageContext } from '../../core/language-context'
import { mainContext } from '../../core/main-context'
import { sh } from '../../core/namespaces'
import Grapoi from '../../Grapoi'
import { nonNullable } from '../../helpers/nonNullable'
import AddLanguage from './AddLanguage'

type Props = {
  selectedLanguage: string
  onChange: (languageCode: string) => void
  dataPointer: Grapoi
  term: Term
  property: Grapoi
}

/**
 * Depending on the context this widget shows a language selector, if the system uses the tabbed display nothing is returned.
 */
export default function LanguageSelector({ selectedLanguage: value, onChange, dataPointer, term, property }: Props) {
  const { languageMode } = useContext(mainContext)
  const { languages, setLanguages, setActiveContentLanguage, activeInterfaceLanguage } = useContext(languageContext)

  const localAllowedLanguages = { ...languages }
  if (!(value in localAllowedLanguages)) localAllowedLanguages[value] = { [value]: value }
  const [isCreatingLanguage, setIsCreatingLanguage] = useState(false)

  const valueLanguages = new Set(
    dataPointer
      .map((pointer: Grapoi) => (pointer.term.termType === 'Literal' ? pointer.term.language : null))
      .filter(nonNullable)
  )
  const uniqueLanguage = property.out(sh('uniqueLang')).term?.value === 'true'

  const filteredLanguages = Object.fromEntries(
    Object.entries(localAllowedLanguages).filter(([key]) => value === key || !valueLanguages.has(key))
  )

  const languageOptions = !uniqueLanguage
    ? localAllowedLanguages
    : term.value
      ? localAllowedLanguages
      : filteredLanguages

  return languageMode === 'individual' ? (
    <>
      <select
        value={value}
        onChange={event => {
          if (event.target.value === '_add_language') {
            setIsCreatingLanguage(true)
          } else {
            onChange(event.target.value)
          }
        }}
      >
        {Object.entries(languageOptions).map(([key, label]) => (
          <option key={key} value={key}>
            {label[activeInterfaceLanguage]}
          </option>
        ))}
        <option value={'_add_language'}>- Add a language -</option>
      </select>

      {isCreatingLanguage ? (
        <AddLanguage
          callback={(language?: { labels: Record<string, string>; code: string }) => {
            setIsCreatingLanguage(false)
            if (language) {
              onChange(language.code)
              setLanguages({ ...languages, [language.code]: language.labels })
              setActiveContentLanguage(language.code)
            }
          }}
        />
      ) : null}
    </>
  ) : null
}
