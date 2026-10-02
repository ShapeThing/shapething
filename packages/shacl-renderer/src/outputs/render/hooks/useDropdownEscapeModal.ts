import { useLayoutEffect, useState } from "react";

/**
 * Lets an absolutely-positioned dropdown panel (a combobox's `.st-combo-results`, SelectListbox's
 * `__listbox`, ...) escape the clipping of Modal's scrolling `.st-modal__content` - attach the
 * returned callback ref to the panel itself. Outside a `<dialog>` this does nothing and the panel
 * keeps its plain CSS positioning.
 *
 * Deliberately *not* a React portal: a showModal()'d dialog sits in the browser's top layer and
 * makes everything outside it inert, so a panel portaled to document.body would render underneath
 * the dialog and be unclickable. Portaling into the dialog itself would work visually, but would
 * move the panel out from under its widget's own wrapper - breaking descendant selectors (e.g.
 * `.st-path-type-select .st-listbox__option`) and every `wrapper.contains(event.relatedTarget)`
 * blur check. Switching the panel to `position: fixed` in place escapes the `overflow` clip just
 * the same (no ancestor inside the modal has a transform/filter/contain that would re-anchor it)
 * while leaving it exactly where it is in the DOM.
 *
 * `sizing` mirrors the panel's own CSS: "width" for panels that are `width: 100%` of their anchor,
 * "min-width" for ones that are `min-width: 100%` and may grow wider.
 */
export function useDropdownEscapeModal<T extends HTMLElement>(
  sizing: "width" | "min-width" = "width",
) {
  const [panel, setPanel] = useState<T | null>(null);

  useLayoutEffect(() => {
    if (!panel?.closest("dialog")) return;
    // The panel's CSS `top: calc(100% + gap)` is relative to its containing block - measure both
    // while it's still absolutely positioned, so the fixed placement reproduces the same gap.
    const anchor = panel.offsetParent as HTMLElement | null;
    if (!anchor) return;
    const gap = panel.getBoundingClientRect().top - anchor.getBoundingClientRect().bottom;

    const place = () => {
      const rect = anchor.getBoundingClientRect();
      panel.style.position = "fixed";
      panel.style.left = `${rect.left}px`;
      panel.style.setProperty(sizing, `${rect.width}px`);
      panel.style.top = `${rect.bottom + gap}px`;
      // Flip above the anchor when the panel would run off the bottom of the viewport and there's
      // more room above it than below.
      const height = panel.offsetHeight;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      if (height > spaceBelow && rect.top - gap > spaceBelow) {
        panel.style.top = `${Math.max(0, rect.top - gap - height)}px`;
      }
    };

    place();
    // Capture phase: the scroll that moves the anchor is .st-modal__content's own, which doesn't
    // bubble to window.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    // Results loading in changes the panel's height (flip decision); a reflow of the form around
    // the anchor can move it without any scroll.
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    observer.observe(anchor);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      observer.disconnect();
    };
  }, [panel, sizing]);

  return setPanel;
}
