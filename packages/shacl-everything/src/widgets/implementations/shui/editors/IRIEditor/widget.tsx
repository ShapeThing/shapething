import { useEffect, useId, useRef, useState } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { Link, Loading } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import { knownIris } from "@/helpers/knownIris.ts";
import { prefixedIri } from "@/helpers/prefixedIri.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useLovSuggestions, type Suggestion } from "@/outputs/render/hooks/useLovSuggestions.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { iriTypesFor } from "./iriType.ts";
import "@/theme/comboBox.css";
import "./style.css";

// Mirrors shui:hasImageFileExtension (src/scoring/widget-scoring.ttl) - same extension list, kept
// in sync by hand since this only drives a live-preview toggle here, not a SHACL score rule.
const IMAGE_EXTENSION_PATTERN = /\.(jpg|jpeg|png|gif|bmp|svg|webp|avif)$/i;

// The full IRI + a friendlier display name for a suggestion row, regardless of which source it
// came from - a local match's own prefixedIri() (falling back to its full IRI when no known
// prefix matches) for a "local" suggestion, LOV's own already-compact prefixedName for a "lov"
// one (see helpers/lovTermSearch.ts).
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

function suggestionUri(suggestion: Suggestion) {
  return suggestion.kind === "local" ? suggestion.iri : suggestion.term.uri;
}

function suggestionKey(suggestion: Suggestion): string {
  return `${suggestion.kind}:${suggestionUri(suggestion).value}`;
}

export default function IRIEditor({ shape, term, setTerm, labelledBy, autoFocus }: WidgetProps) {
  const { sourcePrefixes } = useEnvironment();
  const pattern = shape.get(sh("pattern"))?.source;
  const minLength = shape.get(sh("minLength"));
  const maxLength = shape.get(sh("maxLength"));

  const [localValue, setLocalValue] = useState(term.value);
  // Keep local state in sync if term changes from outside.
  useEffect(() => setLocalValue(term.value), [term.value]);

  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();

  // `localValue` starts (and, after a blur/reopen, restarts) as the field's already-committed
  // value, not empty - so it alone can't tell "the user typed a search" apart from "this field
  // just opened on its existing value". This tracks the former: reset false on every focus, set
  // true only by the onChange handler below (a real keystroke), so suggestions stay hidden until
  // the user actually edits something, even though the field itself shows text right away.
  const [hasTypedSinceFocus, setHasTypedSinceFocus] = useState(false);

  const trimmedValue = localValue.trim();
  const searchQuery = hasTypedSinceFocus ? trimmedValue : "";
  // st:iriType (see iriType.ts) lets the shape scope suggestions to just classes or just
  // properties; undefined (the default) searches LOV for both.
  const lovTypes = iriTypesFor(shape);
  const candidates = knownIris(shape.dataGraph, shape.shapesGraph);
  const { suggestions, isSearchingLov } = useLovSuggestions(candidates, searchQuery, {
    lovTypes,
    enabled: suggestionsOpen,
  });
  const dropdownOpen = suggestionsOpen && (suggestions.length > 0 || isSearchingLov);

  const commit = (value: string) => {
    if (value !== term.value) setTerm(factory.namedNode(value));
  };

  const activateSuggestion = (suggestion: Suggestion) => {
    const value = suggestionUri(suggestion).value;
    setLocalValue(value);
    commit(value);
    setSuggestionsOpen(false);
  };

  const ref = useAutoFocusRef<HTMLInputElement>(autoFocus);

  // A value already present starts collapsed to its prefixedIri text; clicking it opens the
  // input on the full IRI. A freshly added (empty) value has nothing to show, so it opens
  // straight into the input - and committing back down to empty (the value was cleared) falls
  // back to the input too, since there's nothing left to display.
  const [isEditing, setIsEditing] = useState(() => term.value.length === 0);
  const showInput = isEditing || term.value.length === 0;

  const focusOnOpenRef = useRef(false);
  const openForEdit = () => {
    focusOnOpenRef.current = true;
    setIsEditing(true);
  };
  useEffect(() => {
    if (isEditing && focusOnOpenRef.current) {
      focusOnOpenRef.current = false;
      ref.current?.focus();
    }
  }, [isEditing, ref]);

  // Reset once the committed value moves on - a broken image at one IRI shouldn't suppress the
  // preview forever once the user points this property at a different one.
  const [previewFailed, setPreviewFailed] = useState(false);
  useEffect(() => setPreviewFailed(false), [term.value]);

  const showPreview =
    term.value.length > 0 && !previewFailed && IMAGE_EXTENSION_PATTERN.test(term.value);

  return (
    <div className="st-iri-editor">
      <div className="st-iri-editor__row">
        <div className="st-iri-editor__combo">
          {showInput ? (
            <>
              <input
                ref={ref}
                type="text"
                className="st-input"
                role="combobox"
                aria-expanded={dropdownOpen}
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={
                  dropdownOpen && activeIndex >= 0
                    ? `${listboxId}-option-${activeIndex}`
                    : undefined
                }
                value={localValue}
                onChange={(event) => {
                  setLocalValue(event.target.value);
                  setSuggestionsOpen(true);
                  setHasTypedSinceFocus(true);
                  setActiveIndex(-1);
                }}
                onFocus={() => {
                  setSuggestionsOpen(true);
                  setHasTypedSinceFocus(false);
                }}
                onBlur={() => {
                  commit(localValue);
                  setSuggestionsOpen(false);
                  setIsEditing(false);
                }}
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
                    // Only fills the field - doesn't submit the enclosing form.
                    event.preventDefault();
                    activateSuggestion(suggestions[activeIndex]);
                  }
                }}
                autoComplete="off"
                pattern={pattern}
                minLength={minLength}
                maxLength={maxLength}
                aria-labelledby={labelledBy}
              />
              {dropdownOpen && (
                <div id={listboxId} className="st-combo-results" role="listbox">
                  {suggestions.map((suggestion, index) => {
                    const isFirstOfGroup =
                      index === 0 || suggestions[index - 1].kind !== suggestion.kind;
                    const display = suggestionDisplay(suggestion, sourcePrefixes);
                    return (
                      <div key={suggestionKey(suggestion)}>
                        {isFirstOfGroup && (
                          <div className="st-iri-editor-group-label" role="presentation">
                            {suggestion.kind === "local" ? (
                              <Localized id="iri-editor-suggestion-in-use">
                                Already in use
                              </Localized>
                            ) : (
                              <Localized id="iri-editor-suggestion-from-lov">
                                Suggestions
                              </Localized>
                            )}
                          </div>
                        )}
                        <div
                          id={`${listboxId}-option-${index}`}
                          role="option"
                          data-group={suggestion.kind}
                          aria-selected={display.iri === trimmedValue}
                          className={`st-combo-result st-iri-editor-option${
                            index === activeIndex ? " st-combo-result--active" : ""
                          }`}
                          // Keeps focus on the input during the click so onBlur above never fires.
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => activateSuggestion(suggestion)}
                        >
                          <span className="st-iri-editor-option__name">
                            {display.name}
                            {suggestion.kind === "lov" && (
                              <span className="st-iri-editor-option__type">
                                {suggestion.term.type === "class" ? (
                                  <Localized id="iri-editor-suggestion-type-class">
                                    class
                                  </Localized>
                                ) : (
                                  <Localized id="iri-editor-suggestion-type-property">
                                    property
                                  </Localized>
                                )}
                              </span>
                            )}
                          </span>
                          {display.name !== display.iri && (
                            <span className="st-iri-editor-option__iri">{display.iri}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {isSearchingLov && (
                    <div className="st-combo-empty" role="presentation">
                      <Loading />
                      <Localized id="loading">Loading</Localized>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              className="st-input st-iri-editor__display"
              aria-labelledby={labelledBy}
              title={term.value}
              onClick={openForEdit}
            >
              {prefixedIri(term as NamedNode, sourcePrefixes) ?? term.value}
            </button>
          )}
        </div>
        {term.value ? (
          <a
            className="st-input-suffix has-value"
            href={term.value}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Link />
          </a>
        ) : (
          <span className="st-input-suffix">
            <Link />
          </span>
        )}
      </div>
      {showPreview && (
        <div className="st-iri-editor__preview">
          <img
            className="st-iri-editor__preview-image"
            src={term.value}
            alt=""
            onError={() => setPreviewFailed(true)}
          />
        </div>
      )}
    </div>
  );
}
