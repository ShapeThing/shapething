import { useState } from "react";
import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import { useFacetValueCountBounds } from "@/outputs/render/modes/facet/facetData.tsx";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import "./style.css";

function parseCount(value: string | undefined): number | undefined {
  const parsed = value === undefined ? Number.NaN : parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Filters on how many values an instance holds on the path - "between 2 and 5 authors" - rather
 * than on the values themselves. Writes plain sh:minCount/sh:maxCount on the filter shape's
 * sh:property, so the generated shape means exactly that to any SHACL validator too (see
 * facets/compileFilter.ts's compileValueCount for how it's matched here).
 */
export default function CountFacet({ getConstraint, setConstraint, labelledBy }: FacetWidgetProps) {
  // The data's own range of counts, computed by the facet source - an instance with no value at
  // all counts as 0.
  const bounds = useFacetValueCountBounds();
  const dataMin = parseCount(bounds.min?.value);
  const dataMax = parseCount(bounds.max?.value);

  // Seeded from an already-applied constraint (e.g. a restored filter shape), then owned locally so
  // typing is never fought mid-value.
  const [min, setMin] = useState(() => getConstraint(sh("minCount"))[0]?.value ?? "");
  const [max, setMax] = useState(() => getConstraint(sh("maxCount"))[0]?.value ?? "");

  const write = (predicate: NamedNode, raw: string) => {
    const count = parseCount(raw);
    setConstraint(
      predicate,
      count === undefined ? undefined : factory.literal(String(count), xsd("integer")),
    );
  };

  // Same as NumberRangeFacet: the native min/max attributes are only enforced on form submission,
  // which facet mode's "live" facetChangeMode never does - so clamp on blur instead.
  const clampToDataBounds = (raw: string): string => {
    const parsed = parseCount(raw);
    if (parsed === undefined) return raw;
    let clamped = Math.max(parsed, dataMin ?? 0);
    if (dataMax !== undefined) clamped = Math.min(clamped, dataMax);
    return clamped === parsed ? raw : String(clamped);
  };

  const input = (
    value: string,
    setValue: (value: string) => void,
    predicate: NamedNode,
    placeholder: number | undefined,
  ) => (
    <input
      type="number"
      className="st-input"
      inputMode="numeric"
      placeholder={placeholder !== undefined ? String(placeholder) : undefined}
      value={value}
      min={dataMin ?? 0}
      max={dataMax}
      step={1}
      aria-labelledby={labelledBy}
      onChange={(event) => {
        setValue(event.target.value);
        write(predicate, event.target.value);
      }}
      onBlur={() => {
        const clamped = clampToDataBounds(value);
        if (clamped === value) return;
        setValue(clamped);
        write(predicate, clamped);
      }}
    />
  );

  return (
    <div className="st-count-facet">
      {input(min, setMin, sh("minCount"), dataMin)}
      <span className="st-count-facet__separator" aria-hidden>
        –
      </span>
      {input(max, setMax, sh("maxCount"), dataMax)}
    </div>
  );
}
