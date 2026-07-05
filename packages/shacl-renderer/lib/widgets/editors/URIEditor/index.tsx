import factory from '@rdfjs/data-model'
import { useContext } from 'react'
import { MemoIcon } from '../../../components/various/Icon'
import { mainContext } from '../../../core/main-context'
import { linkIcon } from '../../../helpers/icons'
import { isValidIri } from '../../../helpers/isValidIri'
import { useDeferredInput } from '../../../hooks/useDeferredInput'
import { WidgetProps } from '../../widgets-context'

export default function URIEditor({ term, setTerm }: WidgetProps) {
  const { subjectEditLocalNameOnly } = useContext(mainContext)
  const { jsonLdContext } = useContext(mainContext)
  const compactedIri = jsonLdContext.compactIri(term.value)
  let prefixAlias = ''
  const lastPart = term.value.split(/#|\//g).pop()!

  const before = subjectEditLocalNameOnly ? term.value.substring(0, term.value.length - lastPart?.length) : ''
  let value = subjectEditLocalNameOnly ? term.value.split(/#|\//g).pop() : term.value

  const prefixes = Object.fromEntries(Object.entries(jsonLdContext.getContextRaw()).filter(([key]) => key[0] !== '@'))

  if (compactedIri !== term.value) {
    ;[prefixAlias, value] = compactedIri.split(/:(.*)/s)
  }

  const exactMatch = Object.entries(prefixes).find(([, prefix]) => prefix === term.value)?.[0]
  if (exactMatch) {
    prefixAlias = exactMatch
    value = ''
  }

  const { localValue, onChange, onBlur } = useDeferredInput(term, (value: string) => {
    if (subjectEditLocalNameOnly) {
      setTerm(factory.namedNode(`${before}${value ?? ''}`))
      return
    }
    if (isValidIri(value)) {
      setTerm(factory.namedNode(value))
    } else {
      const prefix = prefixes[prefixAlias]
      setTerm(factory.namedNode(`${prefix ?? ''}${value ?? ''}`))
    }
  })

  return (
    <div className="uri-selector" title={term.value}>
      {!subjectEditLocalNameOnly && Object.entries(prefixes).length ? (
        <select
          className="prefix"
          value={prefixAlias}
          onChange={event => {
            const newPrefixAlias = prefixes[event.target.value]
            if (newPrefixAlias) {
              setTerm(factory.namedNode(`${newPrefixAlias ?? ''}${value ?? ''}`))
            } else {
              setTerm(factory.namedNode(``))
            }
          }}
        >
          <option value={''}>(None)</option>
          {Object.entries(prefixes).map(([alias]) => {
            return (
              <option key={alias} value={alias}>
                {alias}
              </option>
            )
          })}
        </select>
      ) : null}
      <input className="input" onChange={onChange} onBlur={onBlur} value={localValue} />

      {term.value ? (
        <a className="link" rel="noopener noreferrer" href={term.value} target="_blank">
          <MemoIcon tabIndex={0} className="iconify" icon={linkIcon} />
        </a>
      ) : null}
    </div>
  )
}
