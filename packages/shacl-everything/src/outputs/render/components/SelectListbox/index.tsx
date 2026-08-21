import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type SelectListboxProps<T extends string> = {
  triggerId?: string;
  ariaLabelledby?: string;
  wrapperClassName?: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
  renderTriggerContent: (value: T) => ReactNode;
  /** Receives `close` so inline actions (e.g. a per-row delete button) can close the dropdown. */
  renderOption: (value: T, close: () => void) => ReactNode;
  /** Extra row appended after all options, e.g. "Add language…". */
  extraRow?: { content: ReactNode; onActivate: () => void };
  /** Called when Delete is pressed on the keyboard-highlighted option. */
  onDeleteKey?: (value: T) => void;
  /** BEM block prefix for generated class names. Defaults to "st-listbox". */
  classPrefix?: string;
};

export default function SelectListbox<T extends string>({
  triggerId,
  ariaLabelledby,
  wrapperClassName,
  value,
  options,
  onChange,
  renderTriggerContent,
  renderOption,
  extraRow,
  onDeleteKey,
  classPrefix = "st-listbox",
}: SelectListboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const generatedId = useId();
  const listboxId = useId();
  const triggerId_ = triggerId ?? generatedId;

  const rowCount = options.length + (extraRow ? 1 : 0);

  useEffect(() => {
    if (open && activeIndex >= 0)
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const close = () => setOpen(false);

  const selectOption = (option: T) => {
    onChange(option);
    close();
    triggerRef.current?.focus();
  };

  const activateRow = (index: number) => {
    if (index < options.length) {
      selectOption(options[index]);
    } else if (extraRow) {
      close();
      triggerRef.current?.focus();
      extraRow.onActivate();
    }
  };

  return (
    <div
      className={[`${classPrefix}__wrapper`, wrapperClassName].filter(Boolean).join(" ")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <button
        ref={triggerRef}
        id={triggerId_}
        type="button"
        className={`st-select ${classPrefix}__trigger`}
        data-value={value}
        aria-labelledby={ariaLabelledby}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        onClick={() => {
          setActiveIndex(options.indexOf(value));
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setActiveIndex(options.indexOf(value));
              setOpen(true);
              return;
            }
            const delta = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((current) => (current + delta + rowCount) % rowCount);
          } else if (event.key === "Home" && open) {
            event.preventDefault();
            setActiveIndex(0);
          } else if (event.key === "End" && open) {
            event.preventDefault();
            setActiveIndex(rowCount - 1);
          } else if (event.key === "Escape") {
            close();
          } else if ((event.key === "Enter" || event.key === " ") && open) {
            event.preventDefault();
            if (activeIndex >= 0) activateRow(activeIndex);
          } else if (
            event.key === "Delete" &&
            open &&
            activeIndex >= 0 &&
            activeIndex < options.length &&
            onDeleteKey
          ) {
            event.preventDefault();
            onDeleteKey(options[activeIndex]);
            close();
          }
        }}
      >
        {renderTriggerContent(value)}
      </button>
      <span className="st-select-arrow" aria-hidden="true" />

      {open && (
        <div id={listboxId} role="listbox" className={`${classPrefix}__listbox`}>
          {options.map((option, index) => (
            <div
              key={option}
              id={`${listboxId}-option-${index}`}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              role="option"
              data-value={option}
              aria-selected={option === value}
              className={
                `${classPrefix}__option` +
                (index === activeIndex ? ` ${classPrefix}__option--active` : "")
              }
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
            >
              {renderOption(option, close)}
            </div>
          ))}
          {extraRow && (
            <div
              id={`${listboxId}-option-${options.length}`}
              ref={(el) => {
                optionRefs.current[options.length] = el;
              }}
              role="option"
              aria-selected={false}
              className={
                `${classPrefix}__option` +
                (activeIndex === options.length ? ` ${classPrefix}__option--active` : "")
              }
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(options.length)}
              onClick={() => {
                close();
                triggerRef.current?.focus();
                extraRow.onActivate();
              }}
            >
              {extraRow.content}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
