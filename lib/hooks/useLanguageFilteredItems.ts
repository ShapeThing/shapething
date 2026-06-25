import type { Literal, Term } from '@rdfjs/types'
import { useCallback, useContext, useEffect, useState } from 'react'
import { languageContext } from '../core/language-context'
import { mainContext } from '../core/main-context'
import Grapoi from '../Grapoi'

export const useLanguageFilteredItems = (fetcher: () => Grapoi) => {
  const { languageMode } = useContext(mainContext)
  const { activeContentLanguage } = useContext(languageContext)

  const filter = useCallback(
    (pointer: Grapoi) =>
      pointer.filter(item => {
        if (languageMode === 'individual') return true
        if (!(item.term as Literal)?.language) return true
        return (item.term as Literal)?.language === activeContentLanguage
      }),
    [languageMode, activeContentLanguage]
  )
  const [items, setItems] = useState(filter(fetcher()))

  useEffect(() => {
    setItems(filter(fetcher()))
  }, [activeContentLanguage])

  const setItemsFiltered = useCallback(
    (pointer: Grapoi) => {
      setItems(filter(pointer))
    },
    [filter]
  )

  return [items, setItemsFiltered] as [Grapoi, React.Dispatch<React.SetStateAction<Grapoi>>]
}

export const filterToCurrentItems = (
  terms: Term[],
  activeContentLanguage: string | undefined,
  isLanguageProperty: boolean
) => {
  return terms.filter(
    term =>
      !activeContentLanguage ||
      !isLanguageProperty ||
      term.termType !== 'Literal' ||
      (activeContentLanguage && term.termType === 'Literal' && term.language === activeContentLanguage) ||
      (term.termType === 'Literal' && term.language === undefined)
  )
}
