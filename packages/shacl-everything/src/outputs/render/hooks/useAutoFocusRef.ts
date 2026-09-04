import { useEffect, useRef } from "react";

/**
 * Focuses the returned ref's element once, on mount, when `autoFocus` is true at that point -
 * never on a later change from false to true, since every caller of this hook only ever passes a
 * value fixed for that widget instance's whole lifetime (see WidgetProps.autoFocus). Not a native
 * `autoFocus` JSX attribute because several of this widget's callers (AutoCompleteEditor,
 * SelectListbox) need the same "focus once, right now" behavior applied to a ref they already
 * manage themselves rather than a plain DOM node this hook creates.
 */
export function useAutoFocusRef<T extends HTMLElement>(autoFocus?: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return ref;
}
