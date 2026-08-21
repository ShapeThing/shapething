import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import type { NamedNode } from "@rdfjs/types";

const INTEGER_DATATYPES = new Set([xsd("integer").value]);

export default function NumberFieldEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const min = shape.get(sh("minInclusive"));
  const max = shape.get(sh("maxInclusive"));
  const datatype = (shape.get(sh("datatype")) ?? xsd("integer")) as NamedNode;

  return (
    <input
      type="number"
      value={term.value}
      onChange={(e) => setTerm(factory.literal(e.target.value, datatype))}
      className="st-input"
      min={min}
      max={max}
      step={datatype && INTEGER_DATATYPES.has(datatype.value) ? 1 : "any"}
      aria-labelledby={labelledBy}
    />
  );
}
