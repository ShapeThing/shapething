import { sh, xsd } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import inputStyle from "@/theme/input.module.scss";

const INTEGER_DATATYPES = new Set([xsd("integer").value]);

export default function NumberFieldEditor({ shape: node }: WidgetProps) {
  const min = node.getOne(sh("minInclusive"))?.value;
  const max = node.getOne(sh("maxInclusive"))?.value;
  const datatype = node.getOne(sh("datatype"))?.value;

  return (
    <input
      type="number"
      className={inputStyle.input}
      min={min ? parseFloat(min) : undefined}
      max={max ? parseFloat(max) : undefined}
      step={datatype && INTEGER_DATATYPES.has(datatype) ? 1 : "any"}
    />
  );
}
