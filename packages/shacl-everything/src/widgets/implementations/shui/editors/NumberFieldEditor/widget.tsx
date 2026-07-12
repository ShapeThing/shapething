import { sh, xsd } from "@/helpers/namespaces.ts";
import type { ObjectWidgetProps } from "@/widgets/types.ts";

const INTEGER_DATATYPES = new Set([xsd("integer").value]);

export default function NumberFieldEditor({ shape: node }: ObjectWidgetProps) {
  const min = node.getOne(sh("minInclusive"))?.value;
  const max = node.getOne(sh("maxInclusive"))?.value;
  const datatype = node.getOne(sh("datatype"))?.value;

  return (
    <input
      type="number"
      min={min ? parseFloat(min) : undefined}
      max={max ? parseFloat(max) : undefined}
      step={datatype && INTEGER_DATATYPES.has(datatype) ? 1 : "any"}
    />
  );
}
