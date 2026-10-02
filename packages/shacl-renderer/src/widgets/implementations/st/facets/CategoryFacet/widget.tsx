import { useMemo } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode, Term } from "@rdfjs/types";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { Loading } from "@/helpers/icons.tsx";
import { sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useOptionLookups } from "@/outputs/render/hooks/useOptionLookups.tsx";
import { useSelectOptions } from "@/outputs/render/hooks/useSelectOptions.tsx";
import { useFacetValueCounts, useFacetValues } from "@/outputs/render/modes/facet/facetData.tsx";
import { valueNodeColor, valueNodeLabel } from "@/resolution/label.ts";
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
 * actually found in the data (useFacetValues - the most common values, queried from the facet
 * source: the local dataGraph or Environment.facetsEndpoint).
 *
 * A federated option's count needs no special handling: counts are queried from the facet source
 * keyed by termKey - an option no instance currently holds simply falls back to this component's
 * own `?? 0`, the same as any other zero-count option.
 *
 * `sh:maxCount 1` renders as single-select (used by TypeSelector's own synthetic root-shape
 * picker) - every other cardinality renders multi-select checkboxes, since picking more than one
 * category value is an ordinary OR-filter (sh:in already means "any of these"). `valueCounts`,
 * only given when Environment.enableFacetOptionCounts is on, shows a count after each option's
 * label.
 *
 * Each option also shows a swatch when st:ColorRole is resolved off the option's own rdf:type (see
 * resolution/label.ts's valueNodeColor) - the same role/mechanism AutoCompleteOption's
 * ClassificationRole chip uses, just applied to the option value itself rather than a nested
 * classification. A federated option resolves to no swatch (its type triples live only on the
 * remote endpoint, never the local dataGraph), same as any other unset role.
 */
export default function CategoryFacet({
  shape,
  getConstraint,
  setConstraint,
  labelledBy,
}: FacetWidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const { facetsEndpoint } = useEnvironment();
  const { values } = useFacetValues();
  const valueCounts = useFacetValueCounts();
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

  // Against an endpoint, an option's label lives there, not in the local dataGraph - resolved via
  // the same batched LabelRole lookup AutoCompleteEditor uses (useOptionLookups), pointed at the
  // endpoint. Locally, valueNodeLabel below reads the dataGraph (and shapesGraph) directly.
  const endpointLookups = useOptionLookups(
    shape,
    useMemo(
      () =>
        facetsEndpoint && !selectQuery
          ? options.filter((option): option is NamedNode => option.termType === "NamedNode")
          : [],
      [facetsEndpoint, selectQuery, options],
    ),
    facetsEndpoint,
  );

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
      {selectQuery && Boolean(federatedError) && (
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
        const endpointLabel = endpointLookups.find((result) => result.iri.equals(option))?.label;
        const label = selectQuery
          ? (federatedLabel ?? option.value)
          : (endpointLabel ?? valueNodeLabel({
              term: option,
              propertyShape: shape,
              languages: [activeLanguage],
            }).value);
        // st:ColorRole, resolved off the option's own rdf:type (see resolution/label.ts's
        // valueNodeColor) - same mechanism as AutoCompleteOption's classification chip, just
        // applied to the option itself rather than a nested classification value. A federated
        // option's own type triples were never materialized into the local dataGraph, so this
        // simply resolves to undefined for those, same as an unset role.
        const color = valueNodeColor({ term: option, propertyShape: shape });
        const checked = selectedKeys.has(termKey(option));

        return (
          <label key={termKey(option)} className="st-category-facet__option">
            <input
              type={singleSelect ? "radio" : "checkbox"}
              name={singleSelect ? labelledBy : undefined}
              checked={checked}
              onChange={(event) => toggle(option, event.target.checked)}
            />
            {color && (
              <span
                className="st-category-facet__swatch"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
            )}
            {label}
            {valueCounts && (
              <span className="st-category-facet__count">
                {" "}
                {valueCounts.get(termKey(option)) ?? 0}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
