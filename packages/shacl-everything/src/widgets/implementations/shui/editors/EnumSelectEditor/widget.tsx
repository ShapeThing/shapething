import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import { Loading } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import AutoCompleteOption from "@/outputs/render/components/AutoCompleteOption/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useOptionLookups } from "@/outputs/render/hooks/useOptionLookups.tsx";
import { useSelectOptions, type ResolvedOption } from "@/outputs/render/hooks/useSelectOptions.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import { selectQueryFor } from "./selectQuery.ts";
import "./style.css";

export default function EnumSelectEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const { enableEditInPlace } = useEnvironment();
  const options = useMemo(() => shape.get(sh("in")), [shape]);
  const selectQuery = useMemo(() => selectQueryFor(shape), [shape]);
  // The property shape's own sh:node - when present (and enableEditInPlace hasn't turned the
  // feature off), the currently selected value can be opened and edited in place (see
  // AutoCompleteOption's resourceEditor prop). Not used for the dropdown options themselves, only
  // the closed trigger's current value.
  const nodeShapes = useMemo(() => shape.get(sh("node")) as Quad_Subject[], [shape]);
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // A sh:select-driven sh:in resolves its own labels as part of its query (useSelectOptions) - the
  // plain rdf:List form instead resolves every NamedNode option's LabelRole label/DepictionRole
  // image up front, in one batched query (useOptionLookups) rather than one per option. A Literal
  // option is already its own label (see valueNodeLabel), so only NamedNode options need a lookup.
  // Both stay deferred until the dropdown is actually opened, so a form with several enum selects
  // (some federated) doesn't fan every one of their queries out on page load - only the closed
  // trigger's own current value (below) needs to resolve eagerly.
  const namedNodeOptions = useMemo(
    () =>
      selectQuery || !hasOpened
        ? []
        : options.filter((option): option is NamedNode => option.termType === "NamedNode"),
    [options, selectQuery, hasOpened],
  );
  const lookups = useOptionLookups(shape, namedNodeOptions);
  const {
    options: selectResolved,
    isLoading: selectLoading,
    error: selectError,
  } = useSelectOptions(shape, hasOpened ? selectQuery : undefined);

  // The batched lookups above only cover the current value once the list has been opened and has
  // resolved (or, for sh:select, if its query happens to return it at all) - until then, resolve it
  // separately, the same way AutoCompleteEditor re-hydrates its currently applied value on mount.
  const hasResolvedCurrentValue = selectQuery
    ? (selectResolved?.some((option) => option.term.value === term.value) ?? false)
    : lookups.some((lookup) => lookup.iri.value === term.value);
  const currentValueIris = useMemo(
    () =>
      term.termType === "NamedNode" && term.value !== "" && !hasResolvedCurrentValue ? [term] : [],
    [term, hasResolvedCurrentValue],
  );
  const currentValueLookups = useOptionLookups(shape, currentValueIris);

  const resolved: ResolvedOption[] = (
    selectQuery
      ? (selectResolved ?? [])
      : options.map((option) => {
          if (option.termType !== "NamedNode") return { term: option };
          const match =
            lookups.find((lookup) => lookup.iri.value === option.value) ??
            currentValueLookups.find((lookup) => lookup.iri.value === option.value);
          return {
            term: option,
            label: match?.label,
            subLabel: match?.subLabel,
            depiction: match?.depiction,
          };
        })
  ).sort((a, b) => {
    if (a.label && b.label) {
      return a.label.localeCompare(b.label);
    }

    return a.term.value.localeCompare(b.term.value);
  });

  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listboxId = useId();

  useEffect(() => {
    if (open && activeIndex >= 0)
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const current =
    resolved.find((option) => option.term.value === term.value) ??
    (currentValueLookups[0]
      ? {
          term,
          label: currentValueLookups[0].label,
          subLabel: currentValueLookups[0].subLabel,
          depiction: currentValueLookups[0].depiction,
        }
      : undefined);

  const openList = () => {
    setHasOpened(true);
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
        aria-labelledby={labelledBy}
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
          resourceEditor={
            enableEditInPlace
              ? {
                  shapesGraph: shape.shapesGraph,
                  dataGraph: shape.dataGraph,
                  scoresGraph: shape.scoresGraph,
                  nodeShapes,
                }
              : undefined
          }
        />
        <span className="st-enum-select__arrow" aria-hidden="true" />
      </button>

      {open && (
        <div id={listboxId} className="st-enum-select__results" role="listbox">
          {selectError ? (
            <div className="st-enum-select__empty" role="alert">
              <Localized id="autocomplete-search-error">Search failed</Localized>
            </div>
          ) : selectLoading ? (
            <div className="st-enum-select__empty">
              <Loading />
              <Localized id="loading">Loading</Localized>
            </div>
          ) : null}
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
