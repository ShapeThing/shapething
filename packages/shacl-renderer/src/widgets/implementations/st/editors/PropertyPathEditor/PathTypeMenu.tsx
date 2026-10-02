import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { Localized } from "@fluent/react";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import PathTypeIcon from "./PathTypeIcon.tsx";
import { PATH_TYPES } from "./mutation-logic.ts";

type Props = {
  x: number;
  y: number;
  current: PropertyPath["type"];
  // Listed but not pickable, see canSwitchTo.
  disabled: PropertyPath["type"][];
  onPick: (type: PropertyPath["type"]) => void;
  // Undefined where there's nothing to edit in place (only a predicate has its IRI); listed disabled.
  onEdit?: () => void;
  onRemove: () => void;
  // `restoreFocus` is set when the menu is dismissed from the keyboard, where focus should go back
  // to what opened it; a pointerdown elsewhere or tabbing away already moves focus itself.
  onClose: (restoreFocus?: boolean) => void;
};

const TYPE_LABEL: Record<PropertyPath["type"], string> = {
  predicate: "property-path-editor-add-type-predicate",
  sequence: "property-path-editor-add-type-sequence",
  alternative: "property-path-editor-add-type-alternative",
  inverse: "property-path-editor-add-type-inverse",
  zeroOrMore: "property-path-editor-add-type-zero-or-more",
  oneOrMore: "property-path-editor-add-type-one-or-more",
  zeroOrOne: "property-path-editor-add-type-zero-or-one",
};

// The segments' colour tokens (defined on .st-property-path-editor), set as --type-color per item
// so PathTypeIcon picks it up. The segment classes themselves aren't reused, as they carry layout.
const TYPE_COLOR: Record<PropertyPath["type"], string> = {
  predicate: "var(--predicate-path-background-color)",
  sequence: "var(--sequence-path-background-color)",
  alternative: "var(--alternative-path-background-color)",
  inverse: "var(--inverse-path-background-color)",
  zeroOrMore: "var(--zero-or-more-path-background-color)",
  oneOrMore: "var(--one-or-more-path-background-color)",
  zeroOrOne: "var(--zero-or-one-path-background-color)",
};

// A popover for top-layer stacking, but "manual": with "auto" the browser's light dismiss closes it
// right away where contextmenu fires on mousedown (Linux), as the release lands outside the menu.
// So Escape, pointerdown outside and focus leaving are handled here. Mounted only while open.
export default function PathTypeMenu({
  x,
  y,
  current,
  disabled,
  onPick,
  onEdit,
  onRemove,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  // The root hands a fresh onClose every render; the effect below must still only run once.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    menu.showPopover();
    // The current type, else the first item that can be picked.
    const focusTarget =
      menu.querySelector<HTMLElement>('[aria-checked="true"]') ??
      menu.querySelector<HTMLElement>('[role="menuitemradio"]:not(:disabled)');
    focusTarget?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!menu.contains(event.target as Node)) onCloseRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [
      ...menuRef.current!.querySelectorAll<HTMLElement>(
        '[role="menuitemradio"]:not(:disabled), [role="menuitem"]:not(:disabled)',
      ),
    ];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  };

  return (
    <div
      ref={menuRef}
      popover="manual"
      role="menu"
      className="st-path-type-menu"
      style={{ left: x, top: y }}
      onBlur={(event) => {
        if (!menuRef.current?.contains(event.relatedTarget as Node)) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      {PATH_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          role="menuitemradio"
          aria-checked={type === current}
          disabled={disabled.includes(type)}
          className="st-path-type-menu-item"
          style={{ "--type-color": TYPE_COLOR[type] } as CSSProperties}
          onClick={() => (type === current ? onClose(true) : onPick(type))}
        >
          <PathTypeIcon type={type} tooltip={false} />
          <Localized id={TYPE_LABEL[type]}>{type}</Localized>
        </button>
      ))}
      <div role="separator" className="st-path-type-menu-separator" />
      <button
        type="button"
        role="menuitem"
        className="st-path-type-menu-item"
        disabled={!onEdit}
        onClick={onEdit}
      >
        <Localized id="property-path-editor-edit">Edit</Localized>
      </button>
      <button
        type="button"
        role="menuitem"
        className="st-path-type-menu-item st-path-type-menu-remove"
        onClick={onRemove}
      >
        <Localized id="property-path-editor-remove">Remove</Localized>
      </button>
    </div>
  );
}
