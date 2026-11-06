import type { Term } from "@rdfjs/types";
import { useCallback, useState } from "react";

export function useDeferredInput(
  term: Term,
  setTerm: (newValue: string) => void,
  afterCallback?: () => void,
) {
  const [localValue, setLocalValue] = useState(term.value);

  const memoizedCallback = useCallback(
    () => (afterCallback ? afterCallback() : undefined),
    [afterCallback],
  );

  // Keep local state in sync if term changes from outside (adjusted during render rather than in
  // an effect, so the stale value is never painted).
  const [syncedValue, setSyncedValue] = useState(term.value);
  if (syncedValue !== term.value) {
    setSyncedValue(term.value);
    setLocalValue(term.value);
  }

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setLocalValue(event.target.value);
    },
    [setLocalValue],
  );

  const onBlur = useCallback(() => {
    if (localValue !== term.value) {
      setTerm(localValue);
    }
    if (memoizedCallback) memoizedCallback();
  }, [localValue, setTerm, term.value, memoizedCallback]);

  return { localValue, onChange, onBlur };
}
