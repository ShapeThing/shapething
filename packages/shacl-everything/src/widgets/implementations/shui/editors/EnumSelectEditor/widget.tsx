import { sh } from "@/helpers/namespaces.ts";
import { localName } from "@/helpers/localName.ts";
import type { WidgetProps } from "@/widgets/types.ts";

export default function EnumSelectEditor({ shape: node }: WidgetProps) {
  const options = node.get(sh("in"));

  return (
    <select>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {localName(option) ?? option.value}
        </option>
      ))}
    </select>
  );
}
