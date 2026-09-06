import { useEffect, useId, useRef, useState } from "react";
import { Localized } from "@fluent/react";
import { Icon } from "@iconify/react";
import { factory } from "@/helpers/factory.ts";
import { Loading, Search } from "@/helpers/icons.tsx";
import { iconifyDatatype } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { useIconifySearch } from "./useIconifySearch.ts";
import "@/theme/comboBox.css";
import "./style.css";

/**
 * Ported from shacl-renderer's own IconifyEditor: a value here is a plain string literal whose
 * datatype is the `iconifyDatatype` sentinel (see namespaces.ts), naming an icon in
 * "<collection>:<icon>" form (e.g. "mdi:home") - the same convention `@iconify/react`'s own
 * `Icon` component resolves live against iconify.design's icon data.
 */
export default function IconifyEditor({
  shape,
  term,
  setTerm,
  labelledBy,
  autoFocus,
}: WidgetProps) {
  // Mirrors AutoCompleteEditor: always starts in "view" so a screen with several empty properties
  // of this widget type doesn't race over which one steals focus - autoFocus is the one deliberate
  // exception (see WidgetProps).
  const [mode, setMode] = useState<"view" | "edit">(autoFocus ? "edit" : "view");
  const { search, setSearch, results, isLoading, error, reset } = useIconifySearch(shape);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listboxId = useId();

  useEffect(() => {
    if (mode === "edit") inputRef.current?.focus();
  }, [mode]);

  // A fresh set of results invalidates whatever the previous list had highlighted.
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  useEffect(() => {
    if (activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const closeEditor = () => {
    reset();
    setMode("view");
  };

  const apply = (icon: string) => {
    setTerm(factory.literal(icon, iconifyDatatype));
    reset();
    setMode("view");
  };

  const options = results ?? [];
  const dropdownOpen = results !== undefined;

  if (mode === "view") {
    return (
      <div className="st-iconify-editor">
        <span tabIndex={0} className="st-iconify-editor__label st-combo-surface">
          {term.value ? (
            <span className="st-iconify-editor__value">
              <Icon icon={term.value} className="st-iconify-editor__icon" />
              <span className="st-iconify-editor__name">{term.value}</span>
            </span>
          ) : (
            <span className="st-iconify-editor__empty" onClick={() => setMode("edit")}>
              <Localized id="select-an-option">- Select an option -</Localized>
            </span>
          )}
        </span>
        <Localized id="autocomplete-edit-value" attrs={{ "aria-label": true }}>
          <button
            type="button"
            className="st-button st-edit-button"
            aria-label="Edit"
            onClick={() => setMode("edit")}
          >
            <Search />
          </button>
        </Localized>
      </div>
    );
  }

  return (
    <div className="st-iconify-editor">
      <Localized id="autocomplete-search-placeholder" attrs={{ placeholder: true }}>
        <input
          ref={inputRef}
          type="text"
          className="st-input"
          placeholder="Search…"
          role="combobox"
          aria-expanded={dropdownOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-labelledby={labelledBy}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onBlur={closeEditor}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              inputRef.current?.blur();
            } else if (event.key === "ArrowDown" && options.length > 0) {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % options.length);
            } else if (event.key === "ArrowUp" && options.length > 0) {
              event.preventDefault();
              setActiveIndex((current) => (current - 1 + options.length) % options.length);
            } else if (event.key === "Home" && options.length > 0) {
              event.preventDefault();
              setActiveIndex(0);
            } else if (event.key === "End" && options.length > 0) {
              event.preventDefault();
              setActiveIndex(options.length - 1);
            } else if (event.key === "Enter") {
              const target = options[activeIndex] ?? options[0];
              if (target) apply(target);
            }
          }}
        />
      </Localized>

      {dropdownOpen && (
        <div id={listboxId} className="st-iconify-editor__results st-combo-results" role="listbox">
          {error ? (
            <div className="st-combo-empty" role="alert">
              <Localized id="autocomplete-search-error">Search failed</Localized>
            </div>
          ) : isLoading ? (
            <div className="st-combo-empty">
              <Loading />
              <Localized id="loading">Loading</Localized>
            </div>
          ) : options.length > 0 ? (
            options.map((icon, index) => (
              <div
                key={icon}
                id={`${listboxId}-option-${index}`}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                title={icon}
                className={`st-iconify-editor__result ${index === activeIndex ? "st-iconify-editor__result--active" : ""}`}
                role="option"
                aria-selected={icon === term.value}
                // Keeps focus on the input during the click so onBlur above never fires for it -
                // onClick still runs normally afterwards.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => apply(icon)}
              >
                <Icon icon={icon} />
              </div>
            ))
          ) : (
            <div className="st-combo-empty">
              <Localized id="autocomplete-no-results">No results found</Localized>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
