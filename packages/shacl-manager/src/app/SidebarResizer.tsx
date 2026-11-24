import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

// The sidebar's width lives in --st-sidebar-width on the root element, so the manager's grid and
// any chrome around it that lines up with the sidebar follow along. This only sets that variable;
// the layout stays in CSS.
const property = "--st-sidebar-width";
const storageKey = "st-sidebar-width";
const fallbackMin = 224;
const max = 640;
const step = 16;

// The page can ask for a wider minimum in --st-sidebar-min-width, in px or rem; CSS holds to it
// as well, this keeps the drag from going below it.
function minWidth() {
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue("--st-sidebar-min-width").trim();
  const number = parseFloat(value);
  if (!number) return fallbackMin;
  if (value.endsWith("rem")) return number * parseFloat(getComputedStyle(root).fontSize);
  return value.endsWith("px") ? number : fallbackMin;
}

const clamp = (width: number) => Math.round(Math.min(max, Math.max(minWidth(), width)));

function apply(width: number | undefined) {
  const style = document.documentElement.style;
  if (width === undefined) style.removeProperty(property);
  else style.setProperty(property, `${width}px`);
}

function load(): number | undefined {
  try {
    const stored = Number(localStorage.getItem(storageKey));
    return stored ? clamp(stored) : undefined;
  } catch {
    return undefined;
  }
}

function save(width: number | undefined) {
  try {
    if (width === undefined) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, String(width));
  } catch {
    // Not remembered then, it still works for this visit.
  }
}

// The remembered width, applied as soon as this loads: before the data model is read, so the
// page doesn't first show the default width and then jump.
const stored = typeof document === "undefined" ? undefined : load();
if (stored !== undefined) apply(stored);

// On the sidebar's border: drag it, or focus it and use the arrow keys. A double click resets it.
export function SidebarResizer() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(stored);

  const current = () => ref.current?.parentElement?.getBoundingClientRect().width ?? minWidth();

  const resize = (next: number | undefined) => {
    const clamped = next === undefined ? undefined : clamp(next);
    apply(clamped);
    setWidth(clamped);
    return clamped;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const left = event.currentTarget.parentElement?.getBoundingClientRect().left ?? 0;
    resize(event.clientX - left);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    save(clamp(current()));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowLeft: -step, ArrowRight: step }[event.key];
    if (event.key === "Home") save(resize(minWidth()));
    else if (event.key === "End") save(resize(max));
    else if (delta) save(resize(current() + delta));
    else return;
    event.preventDefault();
  };

  return (
    <div
      ref={ref}
      className="st-manager__resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the sidebar"
      aria-valuemin={Math.round(minWidth())}
      aria-valuemax={max}
      aria-valuenow={Math.round(width ?? current())}
      tabIndex={0}
      title="Drag to resize, double click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => save(resize(undefined))}
      onKeyDown={onKeyDown}
    />
  );
}
