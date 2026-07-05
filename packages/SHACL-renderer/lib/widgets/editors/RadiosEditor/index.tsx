import { WidgetProps } from '../../widgets-context'

import { Term } from '@rdfjs/types'
import { useContext, useEffect, useState } from 'react'
import { languageContext } from '../../../core/language-context'
import { mainContext } from '../../../core/main-context'
import { fetchOptions } from '../../../helpers/fetchOptions'

export default function RadiosEditor({ property, dataset, term, setTerm }: WidgetProps) {
  const { dataPointer, shapes } = useContext(mainContext)
  const { activeInterfaceLanguage, activeContentLanguage } = useContext(languageContext)
  const [options, setOptions] = useState<{ value: string; label: string; term: Term }[]>([])

  useEffect(() => {
    fetchOptions({
      property,
      dataset,
      shapes,
      activeInterfaceLanguage,
      activeContentLanguage,
      dataPointer
    }).then(options => {
      setOptions(options)
    })
  }, [property, dataset, shapes, activeInterfaceLanguage, activeContentLanguage, dataPointer])

  return options?.length ? (
    <div className="radios-inner">
      {options.map(option => (
        <div key={option.value} className="radio-item">
          <input
            type="radio"
            className="radio-input"
            name={property.value}
            value={option.value}
            checked={term.equals(option.term)}
            id={option.value}
            onChange={() => setTerm(option.term)}
          />
          <label className="radio-label" htmlFor={option.value}>
            {option.label}
          </label>
        </div>
      ))}
    </div>
  ) : null
}
