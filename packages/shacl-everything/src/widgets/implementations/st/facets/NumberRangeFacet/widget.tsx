import { useMemo, useState } from "react";
import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import "./style.css";

const INTEGER_DATATYPES = new Set([xsd("integer").value]);

export default function NumberRangeFacet({
  shape,
  values,
  setConstraint,
  labelledBy,
}: FacetWidgetProps) {
  const datatype = (shape.get(sh("datatype")) ?? xsd("decimal")) as NamedNode;
  const isInteger = INTEGER_DATATYPES.has(datatype.value);

  const numericValues = useMemo(
    () => values.map((value) => parseFloat(value.value)).filter((value) => !Number.isNaN(value)),
    [values],
  );
  const dataMin = numericValues.length > 0 ? Math.min(...numericValues) : undefined;
  const dataMax = numericValues.length > 0 ? Math.max(...numericValues) : undefined;

  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

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
      />
    </div>
  );
}
