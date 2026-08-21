import { clsx } from "clsx";
import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./style.css";
import type { Severity } from "@/types/severity.ts";

export type Placement = "left" | "right" | "top" | "bottom";

type Props = {
  tip: ReactNode;
  children: ReactNode;
  enabled: boolean;
  severity?: Severity;
  bare?: boolean;
  // Preferred side, used whenever there's room for it. Falls back to whichever other side
  // actually fits - see recompute() below.
  placement?: Placement;
};

// Keeps the arrow off the tooltip's rounded corners when aiming it at the anchor.
const ARROW_EDGE_MARGIN = 16;

const OPPOSITE_PLACEMENT: Record<Placement, Placement> = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
};
const ALL_PLACEMENTS: Placement[] = ["left", "right", "top", "bottom"];

export default function Tooltip({
  tip,
  children,
  enabled,
  severity,
  bare,
  placement: preferredPlacement = "left",
}: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [placement, setPlacement] = useState<Placement>(preferredPlacement);
  const [arrowOffset, setArrowOffset] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // anchor-name is a document-wide dashed-ident, so every Tooltip instance needs its own
  // unique value here (via a custom property) or every instance on the page collides on
  // the same anchor.
  const anchorName = `--tooltip-anchor-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // The browser's own position-try-fallbacks only kicks in once a side would actually clip -
  // and since the tooltip's width/height are otherwise free to shrink-to-fit whatever room a
  // side happens to have, a cramped side never clips, so the browser never tries another one.
  // Picking the side ourselves, from real measured space, is what actually gets a comfortably-
  // sized tooltip on the side that has room for it. CSS still owns the resulting coordinates
  // for whichever side we pick (see position-area) - it just no longer picks the side itself.
  const recompute = useCallback(() => {
    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!wrapper || !tooltip) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    // The tooltip is sized with `width: max-content` (see style.css), so this reflects its
    // natural size regardless of which side it's currently rendered on - safe to use for
    // judging every candidate side, not just the one it happens to be showing on right now.
    const tooltipRect = tooltip.getBoundingClientRect();

    const space: Record<Placement, number> = {
      left: wrapperRect.left,
      right: window.innerWidth - wrapperRect.right,
      top: wrapperRect.top,
      bottom: window.innerHeight - wrapperRect.bottom,
    };
    const required: Record<Placement, number> = {
      left: tooltipRect.width,
      right: tooltipRect.width,
      top: tooltipRect.height,
      bottom: tooltipRect.height,
    };

    const candidates = [
      preferredPlacement,
      OPPOSITE_PLACEMENT[preferredPlacement],
      ...ALL_PLACEMENTS.filter(
        (candidate) =>
          candidate !== preferredPlacement && candidate !== OPPOSITE_PLACEMENT[preferredPlacement],
      ),
    ];
    const nextPlacement =
      candidates.find((candidate) => space[candidate] >= required[candidate]) ??
      // Nothing fits cleanly - use whichever side overflows the least.
      candidates.reduce((best, candidate) =>
        space[candidate] - required[candidate] > space[best] - required[best] ? candidate : best,
      );
    setPlacement(nextPlacement);

    const vertical = nextPlacement === "left" || nextPlacement === "right";
    const size = vertical ? tooltipRect.height : tooltipRect.width;
    const anchorCenter = vertical
      ? wrapperRect.top + wrapperRect.height / 2 - tooltipRect.top
      : wrapperRect.left + wrapperRect.width / 2 - tooltipRect.left;
    const max = Math.max(ARROW_EDGE_MARGIN, size - ARROW_EDGE_MARGIN);
    setArrowOffset(Math.min(Math.max(anchorCenter, ARROW_EDGE_MARGIN), max));
  }, [preferredPlacement]);

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
