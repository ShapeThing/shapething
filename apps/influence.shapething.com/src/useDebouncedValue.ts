import { useEffect, useState } from "react";

/** `value`, once it has not changed for `delay` milliseconds. */
export const useDebouncedValue = <Value>(value: Value, delay: number): Value => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
};
