import factory from '@rdfjs/data-model'
import { NamedNode } from '@rdfjs/types'
import { sh, xsd } from '../../../core/namespaces'
import { useDeferredInput } from '../../../hooks/useDeferredInput'
import { WidgetProps } from '../../widgets-context'

export default function NumberFieldEditor({ term, setTerm, property }: WidgetProps) {
  const datatype = property.out(sh('datatype')).term ?? xsd('decimal')

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.literal(value, datatype as NamedNode))
  )

  return <input className="input" type="number" onBlur={onBlur} value={localValue} onChange={onChange} />
}
