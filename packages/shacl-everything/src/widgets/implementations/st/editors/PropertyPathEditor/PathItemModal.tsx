import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { NamedNode } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { factory } from "@/helpers/factory.ts";
import { prefixedIri } from "@/helpers/prefixedIri.ts";
import { Loading } from "@/helpers/icons.tsx";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { buildPathNode } from "./mutation-logic.tsx";
import { usePredicateSuggestions, type Suggestion } from "./usePredicateSuggestions.ts";
import { PATH_TYPE_BADGE } from "./pathTypeVisuals.ts";
import { useDropdownEscapeModal } from "@/outputs/render/hooks/useDropdownEscapeModal.ts";
import "@/theme/comboBox.css";
import "./style.css";

const PATH_TYPES: PropertyPath["type"][] = [
  "predicate",
  "sequence",
  "alternative",
  "inverse",
  "zeroOrMore",
  "oneOrMore",
  "zeroOrOne",
];

function PathTypeLabel({ type }: { type: PropertyPath["type"] }) {
  switch (type) {
    case "predicate":
      return <Localized id="property-path-editor-add-type-predicate">Predicate</Localized>;
    case "sequence":
      return <Localized id="property-path-editor-add-type-sequence">Sequence</Localized>;
    case "alternative":
      return <Localized id="property-path-editor-add-type-alternative">Alternative</Localized>;
    case "inverse":
      return <Localized id="property-path-editor-add-type-inverse">Inverse</Localized>;
    case "zeroOrMore":
      return <Localized id="property-path-editor-add-type-zero-or-more">Zero or more</Localized>;
    case "oneOrMore":
      return <Localized id="property-path-editor-add-type-one-or-more">One or more</Localized>;
    case "zeroOrOne":
      return <Localized id="property-path-editor-add-type-zero-or-one">Zero or one</Localized>;
  }
}

// Used for both the select's trigger and its option rows, so the closed trigger already previews
// the active type's color/icon the same way it'll appear once picked. The badge span uses the
// exact same classes the rendered path tree uses for it (see widget.tsx) - same size, same color,
// same glyph - so it's not a separate, independently-tuned variant of the same badge.
function PathTypeOption({ type }: { type: PropertyPath["type"] }) {
  const badgeClass = PATH_TYPE_BADGE[type];
  return (
    <span className="st-path-type-option">
      {badgeClass && (
        <span className={`${badgeClass} st-path-type`} aria-hidden="true" />
      )}
      <PathTypeLabel type={type} />
    </span>
  );
}

// The full IRI + a friendlier display name for a suggestion row, regardless of which source it
// came from - a local match's own prefixedIri() (falling back to its full IRI when no known
// prefix matches) for a "local" suggestion, the already-compact prefixedName lovTermSearch.ts
// built from the typed prefix for a "lov" one (no local prefix lookup needed for it).
function suggestionDisplay(
  suggestion: Suggestion,
  sourcePrefixes: Record<string, string>,
): { name: string; iri: string } {
  if (suggestion.kind === "local") {
    const iri = suggestion.iri.value;
    return { name: prefixedIri(suggestion.iri, sourcePrefixes) ?? iri, iri };
  }
  return { name: suggestion.term.prefixedName, iri: suggestion.term.uri.value };
}

function suggestionUri(suggestion: Suggestion): NamedNode {
  return suggestion.kind === "local" ? suggestion.iri : suggestion.term.uri;
}

function suggestionKey(suggestion: Suggestion): string {
  return `${suggestion.kind}:${suggestionUri(suggestion).value}`;
}

type Props = {
  open: boolean;
  shape: PropertyUIElement;
  title: ReactNode;
  // Pre-fills the form for editing an existing path node (PredicatePath's own click-to-edit) -
  // left undefined for the "+" add flow, which starts from a blank predicate/"predicate" type.
  initialPredicate?: NamedNode;
  initialType?: PropertyPath["type"];
  onClose: () => void;
  // Called only once the user hits Save - the caller decides how the built node is woven back
  // into the overall path (appended as a new sequence item/branch, or swapped in place for an
  // edit), this component just collects the predicate + path type from the user first.
  onSave: (newItem: PropertyPath) => void;
  // Only offered when editing a node that actually has a container to be removed from (a
  // sequence item or an alternative branch - see PathNodeProps.onRemove in widget.tsx) - omitted
  // entirely (no Remove button at all) for the "+" add flow and for the root path/a wrapper's own
  // sole inner path, neither of which has anywhere to remove this node *from*.
  onRemove?: () => void;
};

// The single form PropertyPathEditor uses both to add a new path item (via each "+") and to edit
// an existing one (via clicking its predicate box) - nothing is written to the path until Save.
export default function PathItemModal({
  open,
  shape,
  title,
  initialPredicate,
  initialType,
  onClose,
  onSave,
  onRemove,
}: Props) {
  // Mounting the form fresh only while open (rather than toggling a `hidden`-style prop on an
  // always-mounted form) means its local state always starts from this call's own
  // initialPredicate/initialType - no stale leftover input from a previous open.
  if (!open) return null;

  // PropertyPathEditor always renders inside EditModeWrapper's own outer <form> - this modal's
  // content is a <form> of its own, so it portals straight to <body> the same way
  // AutoCompleteOption's edit-in-place modal does, rather than nesting one <form> inside another
  // (invalid HTML, and React itself warns/hydration-errors on it).
  return createPortal(
    <PathItemForm
      shape={shape}
      title={title}
      initialPredicate={initialPredicate}
      initialType={initialType}
      onClose={onClose}
      onSave={onSave}
      onRemove={onRemove}
    />,
    document.body,
  );
}

function PathItemForm({
  shape,
  title,
  initialPredicate,
  initialType,
  onClose,
  onSave,
  onRemove,
}: Omit<Props, "open">) {
  const { sourcePrefixes } = useEnvironment();
  const [predicateInput, setPredicateInput] = useState(initialPredicate?.value ?? "");
  const [pathType, setPathType] = useState<PropertyPath["type"]>(initialType ?? "predicate");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const predicateFieldId = useId();
  const pathTypeFieldId = useId();
  const listboxId = useId();
  const dropdownRef = useDropdownEscapeModal<HTMLDivElement>();

  // Editing an existing path item seeds `predicateInput` from its current value (not empty), and
  // the field autofocuses on open - so without this, suggestions for that already-set predicate
  // would appear the instant the modal opens, before the user has typed anything. Mirrors
  // IRIEditor's own `hasTypedSinceFocus` gate: reset false on focus, set true only by onChange.
  const [hasTypedSinceFocus, setHasTypedSinceFocus] = useState(false);

  const trimmedPredicate = predicateInput.trim();
  const canSave = trimmedPredicate.length > 0;
  const searchQuery = hasTypedSinceFocus ? trimmedPredicate : "";

  const { suggestions, isSearchingLov } = usePredicateSuggestions(
    shape,
    searchQuery,
    suggestionsOpen,
  );
  const dropdownOpen = suggestionsOpen && (suggestions.length > 0 || isSearchingLov);

  const activateSuggestion = (suggestion: Suggestion) => {
    setPredicateInput(suggestionUri(suggestion).value);
    setSuggestionsOpen(false);
  };

  return (
    <Modal open onClose={onClose} title={title}>
      <form
        className="st-add-path-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          onSave(buildPathNode(factory.namedNode(trimmedPredicate), pathType));
        }}
      >
        <FormElement
          size="small"
          label={<Localized id="property-path-editor-add-predicate-label">Predicate</Localized>}
          htmlFor={predicateFieldId}
        >
          <div className="st-add-path-predicate-combo">
            <input
              id={predicateFieldId}
              type="text"
              className="st-input"
              role="combobox"
              aria-expanded={dropdownOpen}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={
                dropdownOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
              }
              value={predicateInput}
              onChange={(event) => {
                setPredicateInput(event.target.value);
                setSuggestionsOpen(true);
                setHasTypedSinceFocus(true);
                setActiveIndex(-1);
              }}
              onFocus={() => {
                setSuggestionsOpen(true);
                setHasTypedSinceFocus(false);
              }}
              onBlur={() => setSuggestionsOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && suggestions.length > 0) {
                  event.preventDefault();
                  setSuggestionsOpen(true);
                  setActiveIndex((current) => (current + 1) % suggestions.length);
                } else if (event.key === "ArrowUp" && suggestions.length > 0) {
                  event.preventDefault();
                  setSuggestionsOpen(true);
                  setActiveIndex(
                    (current) => (current - 1 + suggestions.length) % suggestions.length,
                  );
                } else if (event.key === "Escape") {
                  setSuggestionsOpen(false);
                } else if (event.key === "Enter" && dropdownOpen && activeIndex >= 0) {
                  // Only fills the field - doesn't submit the form, so a highlighted suggestion
                  // still leaves the path type free to change before Save.
                  event.preventDefault();
                  activateSuggestion(suggestions[activeIndex]);
                }
              }}
              autoComplete="off"
              autoFocus
            />
            {dropdownOpen && (
              <div ref={dropdownRef} id={listboxId} className="st-combo-results" role="listbox">
                {suggestions.map((suggestion, index) => {
                  const isFirstOfGroup =
                    index === 0 || suggestions[index - 1].kind !== suggestion.kind;
                  const display = suggestionDisplay(suggestion, sourcePrefixes);
                  return (
                    <div key={suggestionKey(suggestion)}>
                      {isFirstOfGroup && (
                        <div className="st-add-path-predicate-group-label" role="presentation">
                          {suggestion.kind === "local" ? (
                            <Localized id="property-path-editor-add-predicate-in-use">
                              Already in use
                            </Localized>
                          ) : (
                            <Localized id="property-path-editor-add-predicate-from-lov">
                              Suggestions
                            </Localized>
                          )}
                        </div>
                      )}
                      <div
                        id={`${listboxId}-option-${index}`}
                        role="option"
                        data-group={suggestion.kind}
                        aria-selected={display.iri === trimmedPredicate}
                        className={`st-combo-result st-add-path-predicate-option${
                          index === activeIndex ? " st-combo-result--active" : ""
                        }`}
                        // Keeps focus on the input during the click so onBlur above never fires.
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => activateSuggestion(suggestion)}
                      >
                        <span className="st-add-path-predicate-option__name">{display.name}</span>
                        {display.name !== display.iri && (
                          <span className="st-add-path-predicate-option__iri">{display.iri}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {isSearchingLov && !suggestions.some((s) => s.kind === "lov") && (
                  <div className="st-add-path-predicate-group-label" role="presentation">
                    <Localized id="property-path-editor-add-predicate-from-lov">
                      Suggestions
                    </Localized>
                  </div>
                )}
                {isSearchingLov && (
                  <div className="st-combo-empty" role="presentation">
                    <Loading />
                    <Localized id="loading">Loading</Localized>
                  </div>
                )}
              </div>
            )}
          </div>
        </FormElement>
        <FormElement
          size="small"
          label={<Localized id="property-path-editor-add-type-label">Path type</Localized>}
          htmlFor={pathTypeFieldId}
        >
          <SelectListbox
            triggerId={pathTypeFieldId}
            wrapperClassName="st-path-type-select"
            value={pathType}
            options={PATH_TYPES}
            onChange={setPathType}
            renderTriggerContent={(value) => <PathTypeOption type={value} />}
            renderOption={(value) => <PathTypeOption type={value} />}
          />
        </FormElement>
        <div className="st-add-path-form-actions">
          {onRemove && (
            <button type="button" className="st-button st-button--danger" onClick={onRemove}>
              <Localized id="property-path-editor-remove">Remove</Localized>
            </button>
          )}
          <div className="st-add-path-form-actions-primary">
            <button type="button" className="st-button st-button--text" onClick={onClose}>
              <Localized id="property-path-editor-add-cancel">Cancel</Localized>
            </button>
            <button type="submit" className="st-button st-button--primary" disabled={!canSave}>
              <Localized id="property-path-editor-add-save">Save</Localized>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
