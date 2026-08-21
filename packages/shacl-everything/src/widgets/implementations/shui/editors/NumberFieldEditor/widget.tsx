import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import type { NamedNode } from "@rdfjs/types";

const INTEGER_DATATYPES = new Set([xsd("integer").value]);

export default function NumberFieldEditor({ shape, term, setTerm, labelledBy }: WidgetProps) {
  const min = shape.getOne(sh("minInclusive"))?.value;
  const max = shape.getOne(sh("maxInclusive"))?.value;
  const datatype = (shape.getOne(sh("datatype")) ?? xsd("integer")) as NamedNode;

  return (
    <input
      type="number"
      value={term.value}
      onChange={(e) => setTerm(factory.literal(e.target.value, datatype))}
      className="st-input"
      min={min ? parseFloat(min) : undefined}
      max={max ? parseFloat(max) : undefined}
      step={datatype && INTEGER_DATATYPES.has(datatype.value) ? 1 : "any"}
      aria-labelledby={labelledBy}
    />
  );
}
