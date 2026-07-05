import factory from '@rdfjs/data-model'
import { Literal } from '@rdfjs/types'

import LanguageSelector from '../../../components/language/LanguageSelector'
import { dash, sh } from '../../../core/namespaces'
import { useDeferredInput } from '../../../hooks/useDeferredInput'
import { WidgetProps } from '../../widgets-context'

export default function TextFieldWithLangEditor({ term, setTerm, property, nodeDataPointer }: WidgetProps) {
  const { language } = term as Literal
  const multiLine = property.out(dash('singleLine')).term?.value === 'false'
  const maxLength = property.out(sh('maxLength')).value ? parseInt(property.out(sh('maxLength')).value) : undefined

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.literal(value, language))
  )

  return (
    <div className="inner">
      {multiLine ? (
        <textarea
          className="input"
          rows={4}
          onBlur={onBlur}
          maxLength={maxLength}
          value={localValue}
          onChange={onChange}
        ></textarea>
      ) : (
        <input
          className="input"
          size={maxLength}
          onBlur={onBlur}
          maxLength={maxLength}
          value={localValue}
          onChange={onChange}
        />
      )}
      <LanguageSelector
        term={term}
        property={property}
        onChange={newLanguage => setTerm(factory.literal(term.value, newLanguage))}
        dataPointer={nodeDataPointer.executeAll(property.out(sh('path')))}
        selectedLanguage={language}
      />
    </div>
  )
}
