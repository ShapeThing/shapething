import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { WidthBounds } from "./useResizableWidth.ts";

const KEYBOARD_STEP = 16;

/**
 * Drag handle on one edge of a column; arrow keys resize too, double click resets. On a column's
 * left edge, dragging (or pressing) left makes the column wider.
 */
export default function ColumnResizer({
  width,
  resize,
  bounds,
  edge,
  label,
}: {
  width: number;
  resize: (width: number, persist?: boolean) => void;
  bounds: WidthBounds;
  edge: "left" | "right";
  label: string;
}) {
  const drag = useRef<{ startX: number; startWidth: number; width: number }>(undefined);
  const direction = edge === "right" ? 1 : -1;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width, width };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current.width =
      drag.current.startWidth + direction * (event.clientX - drag.current.startX);
    resize(drag.current.width, false);
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    resize(drag.current.width);
    drag.current = undefined;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = {
      ArrowLeft: width - direction * KEYBOARD_STEP,
      ArrowRight: width + direction * KEYBOARD_STEP,
      Home: bounds.min,
      End: bounds.max,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    resize(next);
  };

  return (
    <div
      className={`st-manager-resizer st-manager-resizer--${edge}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={() => resize(bounds.initial)}
    />
  );
}
