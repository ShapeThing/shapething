import { useLayoutEffect, type RefObject } from "react";

/**
 * Grows a textarea's height to fit its content on every value change - resets to "auto" first so
 * shrinking (e.g. deleting a line) is picked up too, not just growth.
 */
export function useAutoGrowTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}
