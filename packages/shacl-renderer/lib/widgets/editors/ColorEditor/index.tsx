import factory from '@rdfjs/data-model'
import { NamedNode } from '@rdfjs/types'
import { CSSProperties } from 'react'
import { sh } from '../../../core/namespaces'
import { useDeferredInput } from '../../../hooks/useDeferredInput'
import { WidgetProps } from '../../widgets-context'

export default function ColorEditor({ term, setTerm, property }: WidgetProps) {
  const datatype = property.out(sh('datatype')).term
  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) =>
    setTerm(factory.literal(value, datatype as NamedNode))
  )

  return (
    <div className="input" style={{ '--color': localValue } as CSSProperties}>
      <input type="color" onBlur={onBlur} value={localValue} onChange={onChange} />
    </div>
  )
}
