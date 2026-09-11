import { useEffect, useId, useRef, useState } from "react";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

type Props = {
  triggerId?: string;
  properties: PropertyUIElement[];
  getLabel: (property: PropertyUIElement) => string;
  onSelect: (property: PropertyUIElement) => void;
  placeholder: string;
};

/**
 * A type-to-filter combobox over `properties`, rather than SelectListbox's plain click-to-open
 * list - a real-world profile can put hundreds of optional properties in one drawer (the RDA-FR
 * showcase runs up to ~300), where scanning an unfiltered list defeats the point of hiding them in
 * the first place. Kept local to DrawerPropertyGroup rather than added to the shared SelectListbox:
 * that component's keyboard handling is wired to its own button trigger and reused by several
 * other widgets (WidgetSwitcher, LogicalConstraintSwitcher, InstancesSelectEditor, ...) that never
 * need filtering - retrofitting search there risks their existing behavior for a need only this
 * widget has so far.
 */
export default function AddPropertySelect({
  triggerId,
  properties,
  getLabel,
  onSelect,
  placeholder,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? properties.filter((property) => getLabel(property).toLowerCase().includes(normalizedQuery))
    : properties;

  const commit = (property: PropertyUIElement) => {
    onSelect(property);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  };

  const close = () => setOpen(false);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  return (
    <div
      className="st-listbox__wrapper st-drawer-property-group__search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <input
        id={triggerId}
        type="text"
        className="st-select st-listbox__trigger"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onFocus={() => {
          setOpen(true);
          setActiveIndex(0);
        }}
        // Selecting an option deliberately keeps focus on this input (see the option's own
        // onMouseDown below), so a later click to reopen the closed dropdown lands on an already-
        // focused input and fires no new "focus" event - open on click too, not just on focus.
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            const property = filtered[activeIndex];
            if (property) commit(property);
          } else if (event.key === "Escape") {
            close();
          }
        }}
      />
      <span className="st-select-arrow" aria-hidden="true" />
      {open && filtered.length > 0 && (
        <div id={listboxId} role="listbox" className="st-listbox__listbox">
          {filtered.map((property, index) => (
            <div
              key={property.pathAsSparql() ?? index}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              role="option"
              aria-selected={index === activeIndex}
              className={
                "st-listbox__option" + (index === activeIndex ? " st-listbox__option--active" : "")
              }
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(property)}
            >
              {getLabel(property)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
