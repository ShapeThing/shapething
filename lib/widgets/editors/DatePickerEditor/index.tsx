import factory from '@rdfjs/data-model'
import { xsd } from '../../../core/namespaces'
import { useDeferredInput } from '../../../hooks/useDeferredInput'
import { WidgetProps } from '../../widgets-context'

export default function DatePickerEditor({ term, setTerm }: WidgetProps) {
  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.literal(value, xsd('date')))
  )

  return <input className="input" type="date" onBlur={onBlur} value={localValue} onChange={onChange} />
}
