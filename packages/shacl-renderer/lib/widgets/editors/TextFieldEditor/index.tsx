import factory from '@rdfjs/data-model'
import { dash, sh } from '../../../core/namespaces'
import { useDeferredInput } from '../../../hooks/useDeferredInput'
import { WidgetProps } from '../../widgets-context'

export default function TextFieldEditor({ term, setTerm, property }: WidgetProps) {
  const multiLine = property.out(dash('singleLine')).term?.value === 'false'
  const maxLength = property.out(sh('maxLength')).value ? parseInt(property.out(sh('maxLength')).value) : undefined

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) => setTerm(factory.literal(value)))

  return multiLine ? (
    <textarea
      rows={localValue?.split('\n').length ?? 4}
      maxLength={maxLength}
      className="input"
      onBlur={onBlur}
      value={localValue}
      onChange={onChange}
    />
  ) : (
    <input
      className="input"
      maxLength={maxLength}
      onBlur={onBlur}
      size={maxLength}
      value={localValue}
      onChange={onChange}
    />
  )
}
