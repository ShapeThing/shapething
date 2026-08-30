import { useMemo } from "react";
import type { Term } from "@rdfjs/types";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { valueNodeLabel } from "@/resolution/label.ts";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import "./style.css";

/**
 * Selects from a fixed or data-derived set of category values (rdf:type, skos:inScheme, sh:class-
 * or sh:in-valued properties) - writes sh:in as a SHACL list of the selected values, an ordinary
 * exact-match constraint. `sh:in` on the shape itself (already spec-standard) supplies the option
 * list directly when declared; otherwise falls back to every value actually found in the data
 * (`values`, see structure/facetValues.ts). `sh:maxCount 1` renders as single-select (used by
 * TypeSelector's own synthetic root-shape picker) - every other cardinality renders multi-select
 * checkboxes, since picking more than one category value is an ordinary OR-filter (sh:in already
 * means "any of these").
 */
export default function CategoryFacet({
  shape,
  values,
  getConstraint,
  setConstraint,
  labelledBy,
}: FacetWidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const declared = shape.get(sh("in"));
  const options = useMemo(
    () => dedupeTerms(declared.length > 0 ? declared : values),
    [declared, values],
  );
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
      {options.map((option) => {
        const label = valueNodeLabel({
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
          </label>
        );
      })}
    </div>
  );
}
