import { useState } from "react";
import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import "./style.css";

type Props = FacetWidgetProps & {
  type?: "date" | "datetime-local";
  datatype?: NamedNode;
};

// Also used (parameterized) by DateTimeRangeFacet's own widget.tsx, the same way
// DateTimePickerEditor delegates to DatePickerEditor's sibling TextFieldEditor.
export default function DateRangeFacet({
  getConstraint,
  setConstraint,
  labelledBy,
  type = "date",
  datatype = xsd("date"),
}: Props) {
  // Seeded from an already-applied constraint (e.g. a restored filter shape).
  const [from, setFrom] = useState(() => getConstraint(sh("minInclusive"))[0]?.value ?? "");
  const [till, setTill] = useState(() => getConstraint(sh("maxInclusive"))[0]?.value ?? "");

  return (
    <div className="st-date-range-facet">
      <input
        type={type}
        className="st-input"
        value={from}
        aria-labelledby={labelledBy}
        onChange={(event) => {
          const raw = event.target.value;
          setFrom(raw);
          setConstraint(
            sh("minInclusive"),
            raw === "" ? undefined : factory.literal(raw, datatype),
          );
        }}
      />
      <span className="st-date-range-facet__separator" aria-hidden>
        –
      </span>
      <input
        type={type}
        className="st-input"
        value={till}
        aria-labelledby={labelledBy}
        onChange={(event) => {
          const raw = event.target.value;
          setTill(raw);
          setConstraint(
            sh("maxInclusive"),
            raw === "" ? undefined : factory.literal(raw, datatype),
          );
        }}
      />
    </div>
  );
}
