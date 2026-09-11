import { useLayoutEffect, type RefObject } from "react";

/**
 * Grows a textarea's height to fit its content - resets to "auto" first so shrinking (e.g.
 * deleting a line) is picked up too, not just growth. Also re-measures on a ResizeObserver width
 * change: a width change (e.g. a `st:cssImport` stylesheet landing after mount and reflowing the
 * layout) changes how the same text wraps, which needs the same recalculation as a value change.
 * Only width is compared, not the observer's raw firing - resize() itself changes the textarea's
 * height, which would otherwise re-trigger the same observer on its own output. The follow-up
 * resize() is also deferred to the next frame rather than run straight from the observer callback
 * - mutating the observed element's own height synchronously *during* ResizeObserver's delivery
 * phase is what makes a browser log "ResizeObserver loop completed with undelivered
 * notifications", even though there's no actual infinite loop (the "did width change" guard
 * above already stops it after one correction).
 */
export function useAutoGrowTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const resize = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };

    resize();

    let lastWidth = el.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (el.offsetWidth === lastWidth) return;
      lastWidth = el.offsetWidth;
      requestAnimationFrame(resize);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, value]);
}
