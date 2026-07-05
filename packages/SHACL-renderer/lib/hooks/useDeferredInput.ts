import type { Term } from '@rdfjs/types'
import { useCallback, useEffect, useState } from 'react'

export function useDeferredInput(term: Term, setTerm: (newValue: string) => void, afterCallback?: () => void) {
  const [localValue, setLocalValue] = useState(term.value)

  const memoizedCallback = useCallback(() => (afterCallback ? afterCallback() : undefined), [afterCallback])

  // Keep local state in sync if term changes from outside
  useEffect(() => {
    setLocalValue(term.value)
  }, [term.value, setLocalValue])

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setLocalValue(event.target.value)
    },
    [setLocalValue]
  )

  const onBlur = useCallback(() => {
    if (localValue !== term.value) {
      setTerm(localValue)
    }
    if (memoizedCallback) memoizedCallback()
  }, [localValue, setTerm, term.value, memoizedCallback])

  return { localValue, onChange, onBlur }
}
