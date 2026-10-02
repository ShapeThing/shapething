import { useState } from "react";
import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import { getTimeZone } from "@/resolution/globalConfiguration.ts";
import { inTimeZone, withTimeZone } from "@/helpers/timeZone.ts";
import type { FacetWidgetProps } from "@/widgets/types.ts";
import "./style.css";

type Props = FacetWidgetProps & {
  type?: "date" | "datetime-local";
  datatype?: NamedNode;
};

// Also used (parameterized) by DateTimeRangeFacet's own widget.tsx, the same way
// DateTimePickerEditor delegates to DatePickerEditor's sibling TextFieldEditor.
export default function DateRangeFacet({
  shape,
  getConstraint,
  setConstraint,
  labelledBy,
  type = "date",
  datatype = xsd("date"),
}: Props) {
  // shui:timeZone (3.4): with a zone configured, datetime-local bounds are written with that
  // zone's offset (and a restored bound is shown in that zone's wall-clock time).
  const timeZone = type === "datetime-local" ? getTimeZone(shape.shapesGraph) : undefined;
  const toLiteral = (raw: string) =>
    factory.literal(timeZone ? withTimeZone(raw, timeZone) : raw, datatype);
  const seed = (predicate: typeof datatype) => {
    const value = getConstraint(predicate)[0]?.value ?? "";
    return timeZone ? inTimeZone(value, timeZone) : value;
  };

  // Seeded from an already-applied constraint (e.g. a restored filter shape).
  const [from, setFrom] = useState(() => seed(sh("minInclusive")));
  const [till, setTill] = useState(() => seed(sh("maxInclusive")));

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
            raw === "" ? undefined : toLiteral(raw),
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
            raw === "" ? undefined : toLiteral(raw),
          );
        }}
      />
    </div>
  );
}
