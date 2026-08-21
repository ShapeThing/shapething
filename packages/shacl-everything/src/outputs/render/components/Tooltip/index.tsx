import { clsx } from "clsx";
import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./style.css";
import type { Severity } from "@/types/severity.ts";

type Placement = "left" | "right" | "top" | "bottom";

type Props = {
  tip: ReactNode;
  children: ReactNode;
  enabled: boolean;
  severity?: Severity;
  bare?: boolean;
};

// Keeps the arrow off the tooltip's rounded corners when aiming it at the anchor.
const ARROW_EDGE_MARGIN = 16;

export default function Tooltip({ tip, children, enabled, severity, bare }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [placement, setPlacement] = useState<Placement>("left");
  const [arrowOffset, setArrowOffset] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // anchor-name is a document-wide dashed-ident, so every Tooltip instance needs its own
  // unique value here (via a custom property) or every instance on the page collides on
  // the same anchor.
  const anchorName = `--tooltip-anchor-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // CSS anchor positioning (position-try-fallbacks) picks which side the tooltip lands on,
  // and centers it on the anchor when there's room — but near viewport edges the browser
  // shifts the box to avoid overflowing, so its middle no longer lines up with the anchor.
  // @position-try can't expose either choice back to CSS, so both the arrow's direction and
  // its position along the edge (aimed at the anchor's actual center) are derived here.
  const recompute = useCallback(() => {
    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!wrapper || !tooltip) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const dx =
      tooltipRect.left + tooltipRect.width / 2 - (wrapperRect.left + wrapperRect.width / 2);
    const dy =
      tooltipRect.top + tooltipRect.height / 2 - (wrapperRect.top + wrapperRect.height / 2);
    const nextPlacement: Placement =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "top" : "bottom";
    setPlacement(nextPlacement);

    const vertical = nextPlacement === "left" || nextPlacement === "right";
    const size = vertical ? tooltipRect.height : tooltipRect.width;
    const anchorCenter = vertical
      ? wrapperRect.top + wrapperRect.height / 2 - tooltipRect.top
      : wrapperRect.left + wrapperRect.width / 2 - tooltipRect.left;
    const max = Math.max(ARROW_EDGE_MARGIN, size - ARROW_EDGE_MARGIN);
    setArrowOffset(Math.min(Math.max(anchorCenter, ARROW_EDGE_MARGIN), max));
  }, []);

  const open = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const close = useCallback(() => {
    setShowTooltip(false);
  }, []);

  useLayoutEffect(() => {
    if (!showTooltip) return;

    recompute();

    const observer = new ResizeObserver(recompute);
    observer.observe(wrapperRef.current!);
    observer.observe(tooltipRef.current!);

    window.addEventListener("scroll", recompute, { passive: true, capture: true });
    window.addEventListener("resize", recompute);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [showTooltip, recompute]);

  return !enabled ? (
    children
  ) : (
    <div
      ref={wrapperRef}
      className={clsx(
        "tooltip-wrapper",
        severity && `severity-${severity}`,
        bare && "tooltip-wrapper--bare",
      )}
      style={{ "--tooltip-anchor": anchorName } as React.CSSProperties}
      // Only needed when children aren't already a focusable element of their own (e.g. a
      // disabled button) - React's onFocus/onBlur below still fire on focus bubbling up from a
      // focusable child regardless, so giving the wrapper its own tab stop in that case would
      // just add a redundant stop before the child's.
      tabIndex={bare ? undefined : 0}
      onFocus={open}
      onBlur={close}
      onMouseEnter={open}
      onMouseLeave={close}
    >
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="tooltip"
          data-placement={placement}
          style={
            arrowOffset != null
              ? ({ "--arrow-offset": `${arrowOffset}px` } as React.CSSProperties)
              : undefined
          }
        >
          {tip}
        </div>
      )}
      {children}
    </div>
  );
}
