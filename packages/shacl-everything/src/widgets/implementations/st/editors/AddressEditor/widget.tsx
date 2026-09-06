import { useEffect, useId, useRef, useState } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode, Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { Loading, Search } from "@/helpers/icons.tsx";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { schema } from "@/helpers/namespaces.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import type { BCP47 } from "@/types/BCP47.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { useAddressSearch, type OsmAddress, type OsmSearchResult } from "./useAddressSearch.ts";
import "@/theme/comboBox.css";
import "./style.css";

type AddressFields = {
  street?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

function readAddressFields(
  dataGraph: RdfStore,
  node: Quad_Subject,
  contentLanguage: BCP47,
): AddressFields {
  const read = (predicate: NamedNode) =>
    bestByLanguage(
      dataGraph.getQuads(node, predicate).map((quad) => quad.object),
      [contentLanguage, ""],
    )?.value;

  return {
    street: read(schema("streetAddress")),
    locality: read(schema("addressLocality")),
    region: read(schema("addressRegion")),
    postalCode: read(schema("postalCode")),
    country: read(schema("addressCountry")),
  };
}

// Ported from shacl-renderer's own AddressEditor: a Nominatim result's five sub-fields always
// replace this node's own schema:* triples wholesale, regardless of what (if any) sh:node/
// sh:property shapes a shape author declared for them - the widget owns this fixed set of
// predicates directly, the same way the original did.
const WRITABLE_FIELDS: { predicate: NamedNode; fromResult: (address: OsmAddress) => string }[] = [
  {
    predicate: schema("streetAddress"),
    fromResult: (address) => [address.road, address.house_number].filter(Boolean).join(" "),
  },
  {
    predicate: schema("addressLocality"),
    // Nominatim's own address component naming varies by place type (a village address has no
    // "city" component at all) - fall back through the common alternatives rather than only ever
    // reading "city" the way the original did.
    fromResult: (address) => address.city ?? address.town ?? address.village ?? "",
  },
  { predicate: schema("addressRegion"), fromResult: (address) => address.state ?? "" },
  { predicate: schema("postalCode"), fromResult: (address) => address.postcode ?? "" },
  { predicate: schema("addressCountry"), fromResult: (address) => address.country ?? "" },
];

function applySearchResult(dataGraph: RdfStore, node: Quad_Subject, address: OsmAddress): void {
  for (const field of WRITABLE_FIELDS) {
    for (const quad of dataGraph.getQuads(node, field.predicate)) dataGraph.removeQuad(quad);
    const value = field.fromResult(address).trim();
    if (value) dataGraph.addQuad(factory.quad(node, field.predicate, factory.literal(value)));
  }
}

function resultLines(address: OsmAddress): string[] {
  return [
    [address.road, address.house_number].filter(Boolean).join(" "),
    [address.postcode, address.city ?? address.town ?? address.village].filter(Boolean).join(" "),
    [address.state, address.country].filter(Boolean).join(" "),
  ].filter((line) => line.trim().length > 0);
}

/**
 * Edits a nested schema:PostalAddress-shaped blank/named node's own fixed sub-fields
 * (schema:streetAddress/addressLocality/addressRegion/postalCode/addressCountry) - written wholesale
 * from a chosen Nominatim (OpenStreetMap) search result, the same free/unauthenticated API
 * shacl-renderer's own AddressEditor called directly. Unlike DetailsEditor (the generic nested-node
 * editor), this never recurses into the value's own shape - see score.ttl, opt-in via an explicit
 * shui:editor declaration only, exactly as in the original.
 */
export default function AddressEditor({
  shape,
  term,
  setTerm,
  labelledBy,
  autoFocus,
}: WidgetProps) {
  const node = term as Quad_Subject;
  const { activeLanguage } = useContentLanguage();
  // Mirrors AutoCompleteEditor/IconifyEditor: always starts in "view" so a screen with several
  // empty properties of this widget type doesn't race over which one steals focus - autoFocus is
  // the one deliberate exception (see WidgetProps).
  const [mode, setMode] = useState<"view" | "edit">(autoFocus ? "edit" : "view");
  const { search, setSearch, results, isLoading, error, reset } = useAddressSearch(shape);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listboxId = useId();

  const fields = useReactiveRead(
    shape.dataGraph,
    `address-editor@${term.value}@${activeLanguage}`,
    () => readAddressFields(shape.dataGraph, node, activeLanguage),
  );
  const isEmpty =
    !fields.street && !fields.locality && !fields.region && !fields.postalCode && !fields.country;

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

  const apply = (result: OsmSearchResult) => {
    applySearchResult(shape.dataGraph, node, result.address);
    // A blank node's own identity never changes when its sub-fields are (re)written - this just
    // re-affirms `term` as this property's value, which is what actually links a freshly-created
    // (not yet reachable) node in for the first time (see PropertyUIElement.replaceObject).
    setTerm(term);
    reset();
    setMode("view");
  };

  const options = results ?? [];
  const dropdownOpen = results !== undefined;

  if (mode === "view") {
    return (
      <div className="st-address-editor">
        <span tabIndex={0} className="st-address-editor__label st-combo-surface">
          {isEmpty ? (
            <span className="st-address-editor__empty" onClick={() => setMode("edit")}>
              <Localized id="select-an-option">- Select an option -</Localized>
            </span>
          ) : (
            <span className="st-address-editor__lines">
              {resultLines({
                road: fields.street,
                city: fields.locality,
                postcode: fields.postalCode,
                state: fields.region,
                country: fields.country,
              }).map((line, index) => (
                <span key={index}>{line}</span>
              ))}
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
    <div className="st-address-editor">
      <Localized id="address-search-placeholder" attrs={{ placeholder: true }}>
        <input
          ref={inputRef}
          type="text"
          className="st-input"
          placeholder="Search for an address…"
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
        <div id={listboxId} className="st-address-editor__results st-combo-results" role="listbox">
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
            options.map((result, index) => (
              <div
                key={result.place_id}
                id={`${listboxId}-option-${index}`}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                className={`st-address-editor__result st-combo-result ${index === activeIndex ? "st-address-editor__result--active st-combo-result--active" : ""}`}
                role="option"
                aria-selected={false}
                // Keeps focus on the input during the click so onBlur above never fires for it -
                // onClick still runs normally afterwards.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => apply(result)}
              >
                {resultLines(result.address).map((line, lineIndex) => (
                  <span key={lineIndex}>{line}</span>
                ))}
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
