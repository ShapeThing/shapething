import { useMemo } from "react";
import { Localized } from "@fluent/react";
import type { Term } from "@rdfjs/types";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { Loading } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useSelectOptions } from "@/outputs/render/hooks/useSelectOptions.tsx";
import { valueNodeLabel } from "@/resolution/label.ts";
import { selectQueryFor } from "@/structure/selectQuery.ts";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import "./style.css";

/**
 * Selects from a fixed, data-derived, or federated set of category values (rdf:type,
 * skos:inScheme, sh:class- or sh:in-valued properties) - writes sh:in as a SHACL list of the
 * selected values, an ordinary exact-match constraint. `sh:in` on the shape itself
 * (already spec-standard) supplies the option list directly when declared; a `sh:in [ sh:select ]`
 * (the same federated-query form EnumSelectEditor's own dropdown supports, see
 * structure/selectQuery.ts) resolves its options - and their LabelRole/ClassificationRole/DepictionRole
 * labels, see useSelectOptions - via Comunica instead; otherwise this falls back to every value
 * actually found in the data (`values`, see structure/facetValues.ts).
 *
 * A federated option's `valueCounts` entry needs no special handling: counts are still tallied by
 * walking this property's path over the *local* dataGraph (structure/facetValues.ts), keyed by
 * termKey - a federated option nobody's local data currently holds simply falls back to this
 * component's own `?? 0`, the same as any other zero-count option.
 *
 * `sh:maxCount 1` renders as single-select (used by TypeSelector's own synthetic root-shape
 * picker) - every other cardinality renders multi-select checkboxes, since picking more than one
 * category value is an ordinary OR-filter (sh:in already means "any of these"). `valueCounts`,
 * only given when Environment.enableFacetOptionCounts is on, shows a "(n)" count after each
 * option's label.
 */
export default function CategoryFacet({
  shape,
  values,
  getConstraint,
  setConstraint,
  valueCounts,
  labelledBy,
}: FacetWidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const declared = shape.get(sh("in"));
  const selectQuery = useMemo(() => selectQueryFor(shape), [shape]);
  const {
    options: federatedOptions,
    isLoading: federatedLoading,
    error: federatedError,
  } = useSelectOptions(shape, selectQuery);

  const options = useMemo(() => {
    if (selectQuery) return dedupeTerms((federatedOptions ?? []).map((option) => option.term));
    return dedupeTerms(declared.length > 0 ? declared : values);
  }, [selectQuery, federatedOptions, declared, values]);
  const singleSelect = shape.get(sh("maxCount")) === 1;

  const selected = getConstraint(sh("in"));
  const selectedKeys = new Set(selected.map(termKey));

  const toggle = (option: Term, checked: boolean) => {
    if (singleSelect) {
      setConstraint(sh("in"), checked ? [option] : undefined);
      return;
    }
    const next = checked ? [...selected, option] : selected.filter((term) => !term.equals(option));
    setConstraint(sh("in"), next.length > 0 ? next : undefined);
  };

  return (
    <div
      className="st-category-facet"
      role={singleSelect ? "radiogroup" : "group"}
      aria-labelledby={labelledBy}
    >
      {selectQuery && federatedError && (
        <div className="st-category-facet__empty" role="alert">
          <Localized id="autocomplete-search-error">Search failed</Localized>
        </div>
      )}
      {selectQuery && federatedLoading && (
        <div className="st-category-facet__empty">
          <Loading />
          <Localized id="loading">Loading</Localized>
        </div>
      )}
      {options.map((option) => {
        // A federated option's label comes from useSelectOptions' own resolveRoles lookup (the
        // labeled data - e.g. rdfs:label - lives on the remote endpoint, not the local dataGraph,
        // so valueNodeLabel's local-dataGraph walk would find nothing for it).
        const federatedLabel = selectQuery
          ? federatedOptions?.find((resolved) => resolved.term.equals(option))?.label
          : undefined;
        const label = selectQuery
          ? (federatedLabel ?? option.value)
          : valueNodeLabel({
              term: option,
              propertyShape: shape,
              languages: [activeLanguage],
            }).value;
        const checked = selectedKeys.has(termKey(option));

        return (
          <label key={termKey(option)} className="st-category-facet__option">
            <input
              type={singleSelect ? "radio" : "checkbox"}
              name={singleSelect ? labelledBy : undefined}
              checked={checked}
              onChange={(event) => toggle(option, event.target.checked)}
            />
            {label}
            {valueCounts && (
              <span className="st-category-facet__count">
                {" "}
                ({valueCounts.get(termKey(option)) ?? 0})
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
