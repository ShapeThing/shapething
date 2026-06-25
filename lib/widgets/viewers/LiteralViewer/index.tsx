import { createElement, useContext } from 'react'
import { languageContext } from '../../../core/language-context'
import { mainContext } from '../../../core/main-context'
import { stsr } from '../../../core/namespaces'
import { WidgetProps } from '../../widgets-context'

export default function LiteralViewer({ term, property }: WidgetProps) {
  const { usedLanguageCodes } = useContext(languageContext)
  const { languageMode } = useContext(mainContext)

  const mustShownLanguageCode =
    term.termType === 'Literal' &&
    term.language &&
    (languageMode === 'individual' ||
      usedLanguageCodes.length === 1) /* we hide the languages tab when there is only one language */

  const element = property.out(stsr('htmlElement'))?.value ?? 'span'

  return createElement(
    element,
    { className: 'literal-viewer' },
    term.value,
    mustShownLanguageCode ? <em className="language-label">{term.language}</em> : null
  )
}
