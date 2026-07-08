import { useCallback, useContext } from 'react'
import { languageContext } from '../core/language-context'
import { mainContext } from '../core/main-context'
import { sh } from '../core/namespaces'
import Grapoi from '../Grapoi'
import { nonNullable } from '../helpers/nonNullable'
import { TouchableTerm } from '../helpers/touchableRdf'
import { useWidget } from '../widgets/widgets-context'

export const useEmptyTerm = () => {
  const { activeContentLanguage, languages } = useContext(languageContext)
  const { languageMode } = useContext(mainContext)
  const getWidget = useWidget()

  return useCallback(
    (property: Grapoi, items?: Grapoi) => {
      const widgetItem = getWidget(property, items)
      const defaultValue = !items?.terms.length ? property.out(sh('defaultValue')).term : undefined

      const uniqueLanguage = property.out(sh('uniqueLang')).term?.value === 'true'
      let unusedLanguage: string | undefined

      // In this edge case we pass the pre filtered correct language.
      if (languageMode === 'individual' && items && uniqueLanguage) {
        const valueLanguages = new Set(
          items
            .map((pointer: Grapoi) => (pointer.term.termType === 'Literal' ? pointer.term.language : undefined))
            .filter(nonNullable)
        )
        const unusedLanguages = Object.keys(languages).filter(language => !valueLanguages.has(language))
        unusedLanguage = unusedLanguages[0]
      }

      const emptyTerm =
        defaultValue ??
        (widgetItem?.meta.createTerm
          ? widgetItem?.meta.createTerm(
            { activeContentLanguage: unusedLanguage ?? activeContentLanguage, languageMode },
            property
          )
          : null)

      if (emptyTerm && !defaultValue) (emptyTerm as TouchableTerm).touched = false
      return emptyTerm ? emptyTerm : undefined
    },
    [activeContentLanguage, getWidget]
  )
}
