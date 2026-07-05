import type { Term } from '@rdfjs/types'
import { useContext } from 'react'
import { languageContext } from '../../core/language-context'
import { mainContext } from '../../core/main-context'
import { sh } from '../../core/namespaces'
import Grapoi from '../../Grapoi'
import { allLogicalPointers } from '../../helpers/allLogicalPointers'
import { plusIcon } from '../../helpers/icons'
import { language } from '../../helpers/language'
import { useEmptyTerm } from '../../hooks/useEmptyTerm'
import { useWidget } from '../../widgets/widgets-context'
import { MemoIcon } from '../various/Icon'

type AddButtonsProps = {
  property: Grapoi
  items: Grapoi
  addTerm: (term: Term) => void
}

export function AddButtons({ property, items, addTerm }: AddButtonsProps) {
  const { activeInterfaceLanguage } = useContext(languageContext)
  const { languageMode } = useContext(mainContext)
  const uniqueLang = property.out(sh('uniqueLang')).term?.value === 'true'
  const maxCount = property.out(sh('maxCount')).value
    ? parseInt(property.out(sh('maxCount')).value.toString())
    : Infinity

  const expandedOptions = property.out(sh('or')).isList()
    ? allLogicalPointers(property).map(option => ({
        term: option.terms.at(-1)!,
        pointer: option,
        label: option
          .out(sh('name'))
          // We must remove labels from the base pointer.
          .filter((item: Grapoi) => !property.out(sh('name')).terms.some(term => term.equals(item.term)))
          .best(language([activeInterfaceLanguage, '', '*'])).value
      }))
    : []

  const createEmptyTerm = useEmptyTerm()
  const widgetItem = useWidget()(property, items)

  if (widgetItem?.meta.hidePlusButton || items.ptrs.length >= maxCount || (uniqueLang && languageMode === 'tabs')) {
    return null
  }

  return (
    <div className="plus-options">
      {expandedOptions.length ? (
        expandedOptions.map(expandedOption => (
          <button
            key={expandedOption.term.value}
            onClick={() => {
              const emptyTerm = createEmptyTerm(expandedOption.pointer, items)
              if (emptyTerm) addTerm(emptyTerm)
            }}
            className="button icon secondary outline add-object"
          >
            <MemoIcon icon={plusIcon} /> <span>{expandedOption.label}</span>
          </button>
        ))
      ) : (
        <button
          className="button icon secondary outline add-object"
          onClick={() => {
            const emptyTerm = createEmptyTerm(property, items)
            if (emptyTerm) addTerm(emptyTerm)
          }}
        >
          <MemoIcon icon={plusIcon} />
        </button>
      )}
    </div>
  )
}
