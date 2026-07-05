import { Localized } from '@fluent/react'
import { Term } from '@rdfjs/types'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import Select from 'react-select'
import { languageContext } from '../../../core/language-context'
import { mainContext } from '../../../core/main-context'
import { fetchOptions } from '../../../helpers/fetchOptions'
import { WidgetProps } from '../../widgets-context'

export default function EnumSelectEditor({ property, term, setTerm, dataset }: WidgetProps) {
  const { dataPointer, shapes } = useContext(mainContext)
  const { activeInterfaceLanguage, activeContentLanguage } = useContext(languageContext)

  const [options, setOptions] = useState<{ value: string; label: string; term: Term }[]>([])

  const fetchOptionsArg = useMemo(
    () => ({
      property,
      dataset,
      shapes,
      activeInterfaceLanguage,
      activeContentLanguage,
      dataPointer
    }),
    [property, dataset, shapes, activeInterfaceLanguage, activeContentLanguage, dataPointer]
  )

  useEffect(() => {
    fetchOptions(fetchOptionsArg).then(setOptions)
  }, [fetchOptionsArg])

  const ref = useRef<HTMLSpanElement>(null)
  const root = (ref.current?.closest('dialog,body') ?? document.body) as HTMLElement

  return (
    <>
      {ref.current ? (
        <Select
          unstyled
          options={options}
          onFocus={() => {
            fetchOptions(fetchOptionsArg).then(setOptions)
          }}
          menuPortalTarget={root}
          classNames={{
            menu: () => 'select-menu',
            container: state => (state.isFocused ? 'select-container focus input' : 'input select-container')
          }}
          className="input"
          value={options.find(option => option.value === term.value) || null}
          placeholder={<Localized id="pick-an-option">- Pick an option -</Localized>}
          onChange={option => {
            if (option) {
              setTerm(option.term)
            }
          }}
        />
      ) : null}
      <span ref={ref}></span>
    </>
  )
}
