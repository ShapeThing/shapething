import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode } from "@rdfjs/types";
import { Loading, Plus, Search } from "@/helpers/icons.tsx";
import { sh, st } from "@/helpers/namespaces.ts";
import AutoCompleteOption from "@/outputs/render/components/AutoCompleteOption/index.tsx";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import { useCreateInPlace } from "@/outputs/render/hooks/useCreateInPlace.ts";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInstanceSearch } from "@/outputs/render/hooks/useInstanceSearch.tsx";
import { useOptionLookups } from "@/outputs/render/hooks/useOptionLookups.tsx";
import type { SearchResult } from "@/outputs/render/hooks/query.ts";
import { shaclInstancesOfClass } from "@/resolution/targets.ts";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";
import FacetSearchModal from "@/widgets/implementations/shui/editors/AutoCompleteEditor/FacetSearchModal.tsx";
import { searchQueryFor } from "@/widgets/implementations/shui/editors/AutoCompleteEditor/searchQuery.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { useDropdownEscapeModal } from "@/outputs/render/hooks/useDropdownEscapeModal.ts";
import "@/theme/comboBox.css";
import "./style.css";

export default function AutoCompleteEditor({
  shape,
  term,
  setTerm,
  labelledBy,
  autoFocus,
}: WidgetProps) {
  const existingObjects = useDataGraphObjects(shape);
  const { enableEditInPlace, enableFacetSearchForAutocomplete } = useEnvironment();
  const shClasses = useMemo(() => shape.get(sh("class")), [shape]);
  // "Create new…" (rendered as the last row of the results dropdown, see below) - staged in a
  // scratch copy and only written for real on Done, shared with InstancesSelectEditor (see
  // useCreateInPlace). Its nodeShapes - "the node shape(s) that actually describe this property's
  // values" - double as the facet-search modal's own scope and the edit-in-place resource shapes.
  const {
    canCreate,
    nodeShapes,
    draft,
    start: createNew,
    commit,
    cancel: cancelCreate,
  } = useCreateInPlace(shape, setTerm);

  // Whether the search icon opens the facet-search modal instead of the ordinary inline typeahead
  // (see openSearch below) - gated the same way canCreate/canEditResource are, on there being a
  // known shape to actually render something against. Facet search only ever narrows local
  // dataGraph instances (see FacetSearchModal/instancesMatchingFilterShape), so a property
  // that instead declares shui:searchQuery - a shape author's explicit federated/remote search -
  // must keep using the ordinary typeahead (see useInstanceSearch), not this local-only modal.
  const canFacetSearch =
    enableFacetSearchForAutocomplete && nodeShapes.length > 0 && !searchQueryFor(shape);
  const [facetSearching, setFacetSearching] = useState(false);
  // Every existing sh:class instance the facet-search modal's own facets narrow down - mirrors
  // InstancesSelectEditor's own equivalent "subjects" computation. Only worth computing at all when
  // the modal can actually be opened.
  const facetSearchCandidates = useMemo(() => {
    if (!canFacetSearch) return [];
    const seen = new Set<string>();
    const result: NamedNode[] = [];
    for (const shClass of shClasses) {
      for (const instance of shaclInstancesOfClass(shClass, shape.dataGraph, shape.shapesGraph)) {
        if (instance.termType !== "NamedNode" || seen.has(instance.value)) continue;
        seen.add(instance.value);
        result.push(instance);
      }
    }
    return result.filter(
      (instance) =>
        !existingObjects.some((obj) => obj.value === instance.value && obj.value !== term.value),
    );
  }, [canFacetSearch, shClasses, shape, existingObjects, term]);

  // Normally always starts as "view" regardless of whether `term` already has a value, so a
  // screen with several empty properties of this widget type doesn't turn into a race over which
  // one ends up focused (see the mode effect below) - autoFocus is the one deliberate exception:
  // it's only ever true for the one widget instance a "+" click just mounted (see WidgetProps),
  // so starting that one instance straight in "edit" is exactly the same as if the user had
  // clicked the search icon themselves the instant it appeared.
  const [mode, setMode] = useState<"view" | "edit">(autoFocus ? "edit" : "view");
  const { search, setSearch, results, isLoading, error, reset } = useInstanceSearch(shape);
  const [selected, setSelected] = useState<SearchResult>();
  const [activeIndex, setActiveIndex] = useState(-1);
  // Mirrors EnumSelectEditor's own `open` state: the results dropdown (including the create row)
  // is only shown while the input actually has focus, not merely whenever canCreate is true -
  // without this it would stay open even after closeEditor's blur handling switches back to view.
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listboxId = useId();
  const dropdownRef = useDropdownEscapeModal<HTMLDivElement>();

  // Fires on an actual view->edit transition (the search icon clicked, or a value just cleared -
  // see closeEditor/the empty-state view below) as well as on mount when autoFocus seeded "edit"
  // above - both cases mean the same thing: this specific instance should have a focused input
  // right now.
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

  // st:suggestedValues (only when there's no sh:in): offered in place of search results while
  // nothing has been typed yet. Only NamedNodes, since this widget only ever applies IRI values.
  const suggestedValues = useMemo(
    () =>
      shape.get(sh("in")).length > 0
        ? []
        : shape
            .get(st("suggestedValues"))
            .filter((value): value is NamedNode => value.termType === "NamedNode"),
    [shape],
  );
  const showSuggestions = search.trim() === "" && suggestedValues.length > 0;
  // Labels/depictions are only looked up once the dropdown is actually showing them, so a form
  // with several of these editors doesn't fan every lookup out on page load.
  const suggestionIris = useMemo(
    () => (focused && showSuggestions ? suggestedValues : []),
    [focused, showSuggestions, suggestedValues],
  );
  const suggestionLookups = useOptionLookups(shape, suggestionIris);
  const suggestions: SearchResult[] = suggestedValues.map(
    (iri) => suggestionLookups.find((lookup) => lookup.iri.value === iri.value) ?? { iri },
  );

  // Always back to "view" on blur, even with no value selected - the view render below has its
  // own empty state for that case, so there's no need to keep the search box open just because
  // nothing was picked.
  const closeEditor = () => {
    reset();
    setFocused(false);
    setMode("view");
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

  // What the search icon (and the empty-value label, see the view-mode render below) actually
  // does: opens the facet-search modal when it's available, otherwise falls back to the ordinary
  // inline typeahead, same as before that modal existed.
  const openSearch = () => {
    if (canFacetSearch) {
      setFacetSearching(true);
      return;
    }
    setMode("edit");
  };

  // Done: commits the staged instance (and adopts it as this property's value), then closes the
  // search UI the same way picking an existing result does.
  const submitCreate = () => {
    if (commit()) {
      reset();
      setMode("view");
    }
  };

  // Values already used elsewhere for this (possibly multi-valued) property shouldn't be offered
  // again, other than the one this widget instance currently holds - mirrors InstancesSelectEditor.
  const options = (showSuggestions ? suggestions : (results ?? [])).filter(
    (result) =>
      !existingObjects.some((obj) => obj.value === result.iri.value && obj.value !== term.value),
  );
  // The create row (when offered) is appended after every search result as one more navigable
  // row of the same listbox - see the dropdown markup below.
  const rowCount = options.length + (canCreate ? 1 : 0);
  const dropdownOpen = focused && (results !== undefined || showSuggestions || canCreate);

  // Rendered from both modes below - creating stays in "edit" mode until the modal is submitted
  // (see submitCreate), so the modal has to stay reachable from the "edit" mode search UI that
  // triggers it, not just from "view".
  const createModal = draft && (
    <Modal
      open
      onClose={cancelCreate}
      title={<Localized id="create-new-reference-title">New item</Localized>}
      dataGraph={draft.dataGraph}
    >
      <NodeUIElementChildren nodeUiElement={draft.node} />
      <div className="st-autocomplete__create-actions">
        <button type="button" className="st-button st-button--primary" onClick={submitCreate}>
          <Localized id="create-new-reference-done">Done</Localized>
        </button>
      </div>
    </Modal>
  );

  if (mode === "view") {
    return (
      <div
        className={`st-autocomplete ${term.value ? "st-autocomplete--filled" : "st-autocomplete--empty"}`}
      >
        <span
          tabIndex={0}
          className="st-autocomplete__label st-combo-surface"
          onClick={() => !term.value && openSearch()}
        >
          {term.value ? (
            <AutoCompleteOption
              term={term}
              label={current?.label}
              classification={current?.classification}
              depiction={current?.depiction}
              resourceEditor={
                enableEditInPlace
                  ? {
                      shapesGraph: shape.shapesGraph,
                      dataGraph: shape.dataGraph,
                      scoresGraph: shape.scoresGraph,
                      widgetRegistry: shape.widgetRegistry,
                      nodeShapes,
                    }
                  : undefined
              }
            />
          ) : (
            <span className="st-autocomplete__empty">
              <Localized id="select-an-option">- Select an option -</Localized>
            </span>
          )}
        </span>
        <Localized id="autocomplete-edit-value" attrs={{ "aria-label": true }}>
          <button
            type="button"
            className="st-button st-edit-button"
            aria-label="Edit"
            onClick={openSearch}
          >
            <Search />
          </button>
        </Localized>
        {createModal}
        {facetSearching && (
          <FacetSearchModal
            onClose={() => setFacetSearching(false)}
            shape={shape}
            nodeShapes={nodeShapes}
            candidateInstances={facetSearchCandidates}
            onSelect={(result) => {
              apply(result);
              setFacetSearching(false);
            }}
          />
        )}
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
          aria-expanded={dropdownOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-labelledby={labelledBy}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            // Focus moving to this value's own fly-out (WidgetSwitcher, LogicalConstraintSwitcher,
            // AlternativePathSwitcher - see WidgetSlot) isn't the user leaving this field, just
            // clicking a control that lives outside the <input> itself - closeEditor here would
            // yank the search box away mid-click, back to "view" mode. Mirrors IRIEditor's own
            // onBlur guard.
            const nextFocus = event.relatedTarget as Element | null;
            if (nextFocus?.closest(".st-property-object__fly-out")) return;
            closeEditor();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              inputRef.current?.blur();
            } else if (event.key === "ArrowDown" && rowCount > 0) {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % rowCount);
            } else if (event.key === "ArrowUp" && rowCount > 0) {
              event.preventDefault();
              setActiveIndex((current) => (current - 1 + rowCount) % rowCount);
            } else if (event.key === "Home" && rowCount > 0) {
              event.preventDefault();
              setActiveIndex(0);
            } else if (event.key === "End" && rowCount > 0) {
              event.preventDefault();
              setActiveIndex(rowCount - 1);
            } else if (event.key === "Enter") {
              if (activeIndex >= options.length && canCreate) {
                createNew();
              } else {
                const target = options[activeIndex] ?? options[0];
                if (target) apply(target);
              }
            }
          }}
        />
      </Localized>

      {dropdownOpen && (
        <div ref={dropdownRef} id={listboxId} className="st-autocomplete__results st-combo-results" role="listbox">
          {error && !showSuggestions ? (
            <div className="st-autocomplete__empty st-combo-empty" role="alert">
              <Localized id="autocomplete-search-error">Search failed</Localized>
            </div>
          ) : isLoading && !showSuggestions ? (
            <div className="st-autocomplete__empty st-combo-empty">
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
                className={`st-autocomplete__result st-combo-result ${index === activeIndex ? "st-autocomplete__result--active st-combo-result--active" : ""}`}
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
                  classification={result.classification}
                  depiction={result.depiction}
                  highlight={search}
                />
              </div>
            ))
          ) : results !== undefined && !showSuggestions ? (
            <div className="st-autocomplete__empty st-combo-empty">
              <Localized id="autocomplete-no-results">No results found</Localized>
            </div>
          ) : null}
          {canCreate && (
            <div
              id={`${listboxId}-option-${options.length}`}
              ref={(el) => {
                optionRefs.current[options.length] = el;
              }}
              className={`st-autocomplete__result st-autocomplete__result--create st-combo-result ${options.length === activeIndex ? "st-autocomplete__result--active st-combo-result--active" : ""}`}
              role="option"
              aria-selected={false}
              // Keeps focus on the input during the click, same as every result row above - onClick
              // still runs normally afterwards.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(options.length)}
              onClick={createNew}
            >
              <span className="st-create-option">
                <Plus />
                <Localized id="create-new-reference-option">Create new…</Localized>
              </span>
            </div>
          )}
        </div>
      )}
      {createModal}
    </div>
  );
}
