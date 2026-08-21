import { useEffect, useId, useRef, useState } from "react";
import { Localized } from "@fluent/react";
import { Edit, Loading } from "@/helpers/icons.tsx";
import AutoCompleteOption from "@/outputs/render/components/AutoCompleteOption/index.tsx";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useInstanceSearch } from "@/outputs/render/hooks/useInstanceSearch.tsx";
import { useOptionLookups } from "@/outputs/render/hooks/useOptionLookups.tsx";
import type { SearchResult } from "@/outputs/render/hooks/query.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function AutoCompleteEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const existingObjects = useDataGraphObjects(shape);

  const [mode, setMode] = useState<"view" | "edit">(term.value ? "view" : "edit");
  const { search, setSearch, results, isLoading, error, reset } = useInstanceSearch(shape);
  const [selected, setSelected] = useState<SearchResult>();
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listboxId = useId();

  useEffect(() => {
    if (mode === "edit") inputRef.current?.focus();
  }, [mode]);

  // `term` can go from having a value to being empty without this widget remounting - e.g. the
  // property row is keyed by index, so removing its only value swaps in a fresh empty term on the
  // same instance (see PropertyUIComponent). Search mode should always be shown once that happens,
  // not whatever mode was left over from before the value disappeared.
  useEffect(() => {
    if (!term.value) setMode("edit");
  }, [term.value]);

  // A fresh set of results invalidates whatever the previous list had highlighted.
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  useEffect(() => {
    if (activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Resolves the label/depiction for whatever value this property already holds - selecting a
  // search result sets `selected` directly (see apply below) since that query already has them;
  // this only needs a fresh lookup for a value that got here some other way (e.g. already present
  // on mount) - see useOptionLookups.
  const currentIris =
    term.termType === "NamedNode" && term.value !== "" && selected?.iri.value !== term.value
      ? [term]
      : [];
  const lookups = useOptionLookups(shape, currentIris);
  const current = selected?.iri.value === term.value ? selected : lookups[0];

  const closeEditor = () => {
    reset();
    setMode(term.value ? "view" : "edit");
  };

  const apply = (result: SearchResult) => {
    setTerm(result.iri);
    setSelected(result);
    // Not closeEditor(): its term.value check would still see the pre-selection term, since
    // setTerm's write hasn't round-tripped back into this prop yet - a result was just chosen, so
    // the value display is always correct here regardless of what `term` currently reads.
    reset();
    setMode("view");
  };

  // Values already used elsewhere for this (possibly multi-valued) property shouldn't be offered
  // again, other than the one this widget instance currently holds - mirrors InstancesSelectEditor.
  const options = (results ?? []).filter(
    (result) =>
      !existingObjects.some((obj) => obj.value === result.iri.value && obj.value !== term.value),
  );

  if (mode === "view") {
    return (
      <div className="st-autocomplete">
        <span tabIndex={0} className="st-autocomplete__label">
          <AutoCompleteOption
            term={term}
            label={current?.label}
            subLabel={current?.subLabel}
            depiction={current?.depiction}
          />
        </span>
        <Localized id="autocomplete-edit-value" attrs={{ "aria-label": true }}>
          <button
            type="button"
            className="st-button st-edit-button"
            aria-label="Edit"
            onClick={() => setMode("edit")}
          >
            <Edit />
          </button>
        </Localized>
      </div>
    );
  }

  return (
    <div className="st-autocomplete">
      <Localized id="autocomplete-search-placeholder" attrs={{ placeholder: true }}>
        <input
          ref={inputRef}
          type="text"
          className="st-input"
          placeholder="Search…"
          role="combobox"
          aria-expanded={results !== undefined}
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

      {results !== undefined && (
        <div id={listboxId} className="st-autocomplete__results" role="listbox">
          {error ? (
            <div className="st-autocomplete__empty" role="alert">
              <Localized id="autocomplete-search-error">Search failed</Localized>
            </div>
          ) : isLoading ? (
            <div className="st-autocomplete__empty">
              <Loading />
              <Localized id="loading">Loading</Localized>
            </div>
          ) : options.length > 0 ? (
            options.map((result, index) => (
              <div
                key={result.iri.value}
                id={`${listboxId}-option-${index}`}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                className={`st-autocomplete__result ${index === activeIndex && "st-autocomplete__result--active"}`}
                role="option"
                aria-selected={result.iri.value === term.value}
                // Keeps focus on the input during the click so onBlur above never fires for it -
                // onClick still runs normally afterwards.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => apply(result)}
              >
                <AutoCompleteOption
                  term={result.iri}
                  label={result.label}
                  subLabel={result.subLabel}
                  depiction={result.depiction}
                  highlight={search}
                />
              </div>
            ))
          ) : (
            <div className="st-autocomplete__empty">
              <Localized id="autocomplete-no-results">No results found</Localized>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
