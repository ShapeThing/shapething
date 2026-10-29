import { useCallback, useState } from "react";

const STORAGE_KEY_PREFIX = "shacl-manager:width:";

export type WidthBounds = { min: number; max: number; initial: number };

export const SIDEBAR_BOUNDS: WidthBounds = { min: 160, max: 640, initial: 256 };
export const PANEL_BOUNDS: WidthBounds = { min: 280, max: 1200, initial: 560 };

const clamp = (width: number, { min, max }: WidthBounds) =>
  Math.round(Math.min(max, Math.max(min, width)));

// localStorage can throw (privacy mode, sandboxed iframe, quota errors) - the width is a
// nice-to-have, so failures fall back to the initial width rather than surfacing.
function readWidth(storageKey: string, bounds: WidthBounds): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY_PREFIX + storageKey));
    return stored ? clamp(stored, bounds) : bounds.initial;
  } catch {
    return bounds.initial;
  }
}

function persistWidth(storageKey: string, width: number) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + storageKey, String(width));
  } catch {
    // best-effort only, see readWidth
  }
}

/** A user-resizable column width (px), kept in localStorage under `storageKey`. */
export function useResizableWidth(storageKey: string, bounds: WidthBounds) {
  const [width, setWidth] = useState(() => readWidth(storageKey, bounds));

  // `persist` is false while dragging, so localStorage is only written once the drag ends.
  const resize = useCallback(
    (next: number, persist = true) => {
      const clamped = clamp(next, bounds);
      setWidth(clamped);
      if (persist) persistWidth(storageKey, clamped);
    },
    [storageKey, bounds],
  );

  return [width, resize] as const;
}
