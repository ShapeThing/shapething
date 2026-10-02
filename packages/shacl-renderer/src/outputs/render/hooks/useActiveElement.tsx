import { useSyncExternalStore } from "react";

/**
 * One shared focus tracker for the whole document, rather than one per caller: focus is a
 * document-global fact, so a single pair of focusin/focusout listeners (attached lazily on the
 * first subscriber, detached after the last) serves every value slot at once. Callers subscribe
 * through useActiveElementSelector with a selector deriving just the answer *they* care about
 * (e.g. "is focus within my own wrapper?") - useSyncExternalStore only re-renders a subscriber whose
 * selected answer actually changed, so a focus move re-renders the slot losing focus and the one
 * gaining it, not every slot in the form (as a per-caller useState of the raw activeElement did).
 */
let activeElement: Element | null = typeof document === "undefined" ? null : document.activeElement;
const listeners = new Set<() => void>();

function update() {
  if (document.activeElement === activeElement) return;
  activeElement = document.activeElement;
  for (const listener of listeners) listener();
}

// focusout fires before the next element's focusin, while document.activeElement is still the
// element being left (or already <body>) - deferred a tick so focus moving *between* two elements
// never publishes that transient in-between state, while focus leaving to nowhere still does.
function updateDeferred() {
  setTimeout(update, 0);
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", updateDeferred);
    // Focus may have moved while nobody was listening.
    activeElement = document.activeElement;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", updateDeferred);
    }
  };
}

/**
 * Re-renders only when `selector(activeElement)` changes. `selector` must return a primitive (or
 * otherwise referentially stable) value; it's also re-run on every render of the caller, so it may
 * read a ref's current value (and does - see useFocusWithin), picking up a ref attached after the
 * first render on the very next check useSyncExternalStore makes after commit.
 */
export function useActiveElementSelector<T>(selector: (activeElement: Element | null) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(activeElement),
    () => selector(null),
  );
}
