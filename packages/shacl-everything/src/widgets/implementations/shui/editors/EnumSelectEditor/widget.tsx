import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { NamedNode } from "@rdfjs/types";
import { sh } from "@/helpers/namespaces.ts";
import AutoCompleteOption from "@/outputs/render/components/AutoCompleteOption/index.tsx";
import { useOptionLookups } from "@/outputs/render/hooks/useOptionLookups.tsx";
import { useSelectOptions, type ResolvedOption } from "@/outputs/render/hooks/useSelectOptions.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import { selectQueryFor } from "./selectQuery.ts";
import "./style.css";

export default function EnumSelectEditor({ shape, term, setTerm }: WidgetProps) {
  const options = useMemo(() => shape.get(sh("in")), [shape]);
  const selectQuery = useMemo(() => selectQueryFor(shape), [shape]);

  // A sh:select-driven sh:in resolves its own labels as part of its query (useSelectOptions) - the
  // plain rdf:List form instead resolves every NamedNode option's LabelRole label/DepictionRole
  // image up front, in one batched query (useOptionLookups) rather than one per option. A Literal
  // option is already its own label (see valueNodeLabel), so only NamedNode options need a lookup.
  const namedNodeOptions = useMemo(
    () =>
      selectQuery
        ? []
        : options.filter((option): option is NamedNode => option.termType === "NamedNode"),
    [options, selectQuery],
  );
  const lookups = useOptionLookups(shape, namedNodeOptions);
  const selectResolved = useSelectOptions(shape, selectQuery);

  const resolved: ResolvedOption[] = selectQuery
    ? (selectResolved ?? [])
    : options.map((option) => {
        if (option.termType !== "NamedNode") return { term: option };
        const match = lookups.find((lookup) => lookup.iri.value === option.value);
        return {
          term: option,
          label: match?.label,
          subLabel: match?.subLabel,
          depiction: match?.depiction,
        };
      });

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listboxId = useId();

  useEffect(() => {
    if (open && activeIndex >= 0)
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const current = resolved.find((option) => option.term.value === term.value);

  const openList = () => {
    setActiveIndex(
      Math.max(
        resolved.findIndex((option) => option.term.value === term.value),
        0,
      ),
    );
    setOpen(true);
  };

  const apply = (option: ResolvedOption) => {
    setTerm(option.term);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="st-enum-select"
      data-block-fly-out
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="st-enum-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) openList();
            else if (resolved.length > 0) setActiveIndex((index) => (index + 1) % resolved.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) openList();
            else if (resolved.length > 0)
              setActiveIndex((index) => (index - 1 + resolved.length) % resolved.length);
          } else if (event.key === "Home" && open && resolved.length > 0) {
            event.preventDefault();
            setActiveIndex(0);
          } else if (event.key === "End" && open && resolved.length > 0) {
            event.preventDefault();
            setActiveIndex(resolved.length - 1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!open) openList();
            else {
              const target = resolved[activeIndex] ?? current;
              if (target) apply(target);
            }
          }
        }}
      >
        <AutoCompleteOption
          term={term}
          label={current?.label}
          subLabel={current?.subLabel}
          depiction={current?.depiction}
        />
        <span className="st-enum-select__arrow" aria-hidden="true" />
      </button>

      {open && (
        <div id={listboxId} className="st-enum-select__results" role="listbox">
          {resolved.map((option, index) => (
            <div
              key={option.term.value}
              id={`${listboxId}-option-${index}`}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              className={`st-enum-select__result ${index === activeIndex ? "st-enum-select__result--active" : ""}`}
              role="option"
              aria-selected={option.term.value === term.value}
              // Keeps focus on the trigger during the click so onBlur above never fires for it -
              // onClick still runs normally afterwards.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => apply(option)}
            >
              <AutoCompleteOption
                term={option.term}
                label={option.label}
                subLabel={option.subLabel}
                depiction={option.depiction}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
