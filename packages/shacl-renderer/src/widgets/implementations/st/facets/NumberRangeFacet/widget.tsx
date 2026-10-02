import { useState } from "react";
import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import { useFacetValueBounds } from "@/outputs/render/modes/facet/facetData.tsx";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import "./style.css";

const INTEGER_DATATYPES = new Set([xsd("integer").value]);

function parseBound(value: string | undefined): number | undefined {
  const parsed = value === undefined ? Number.NaN : parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export default function NumberRangeFacet({
  shape,
  getConstraint,
  setConstraint,
  labelledBy,
}: FacetWidgetProps) {
  const datatype = (shape.get(sh("datatype")) ?? xsd("decimal")) as NamedNode;
  const isInteger = INTEGER_DATATYPES.has(datatype.value);

  // The data's own range, computed by the facet source (MIN/MAX) rather than by pulling every value.
  const bounds = useFacetValueBounds();
  const dataMin = parseBound(bounds.min?.value);
  const dataMax = parseBound(bounds.max?.value);

  // Seeded from an already-applied constraint (e.g. a restored filter shape), then owned locally so
  // typing is never fought mid-value.
  const [min, setMin] = useState(() => getConstraint(sh("minInclusive"))[0]?.value ?? "");
  const [max, setMax] = useState(() => getConstraint(sh("maxInclusive"))[0]?.value ?? "");

  // The HTML min/max attributes below only get enforced by the browser at form submission, and
  // facet mode's default "live" mode never submits a form - so an out-of-bounds value typed here
  // would otherwise just sit there, unenforced. Clamped on blur (not on every keystroke, so typing
  // itself is never fought mid-value) to the nearest known data bound.
  const clampToDataBounds = (raw: string): string => {
    if (raw === "") return raw;
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return raw;
    let clamped = parsed;
    if (dataMin !== undefined) clamped = Math.max(clamped, dataMin);
    if (dataMax !== undefined) clamped = Math.min(clamped, dataMax);
    return clamped === parsed ? raw : String(clamped);
  };

  return (
    <div className="st-number-range-facet">
      <input
        type="number"
        className="st-input"
        placeholder={dataMin !== undefined ? String(dataMin) : undefined}
        value={min}
        min={dataMin}
        max={dataMax}
        step={isInteger ? 1 : "any"}
        aria-labelledby={labelledBy}
        onChange={(event) => {
          const raw = event.target.value;
          setMin(raw);
          setConstraint(
            sh("minInclusive"),
            raw === "" ? undefined : factory.literal(raw, datatype),
          );
        }}
        onBlur={() => {
          const clamped = clampToDataBounds(min);
          if (clamped === min) return;
          setMin(clamped);
          setConstraint(sh("minInclusive"), factory.literal(clamped, datatype));
        }}
      />
      <span className="st-number-range-facet__separator" aria-hidden>
        –
      </span>
      <input
        type="number"
        className="st-input"
        placeholder={dataMax !== undefined ? String(dataMax) : undefined}
        value={max}
        min={dataMin}
        max={dataMax}
        step={isInteger ? 1 : "any"}
        aria-labelledby={labelledBy}
        onChange={(event) => {
          const raw = event.target.value;
          setMax(raw);
          setConstraint(
            sh("maxInclusive"),
            raw === "" ? undefined : factory.literal(raw, datatype),
          );
        }}
        onBlur={() => {
          const clamped = clampToDataBounds(max);
          if (clamped === max) return;
          setMax(clamped);
          setConstraint(sh("maxInclusive"), factory.literal(clamped, datatype));
        }}
      />
    </div>
  );
}
