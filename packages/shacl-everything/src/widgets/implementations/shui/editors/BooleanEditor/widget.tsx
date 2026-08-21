import { factory } from "@/helpers/factory.ts";
import { xsd } from "@/helpers/namespaces.ts";
import type { WidgetProps } from "@/widgets/types.ts";

export default function BooleanEditor({ term, setTerm, labelledBy }: WidgetProps) {
  return (
    <input
      type="checkbox"
      checked={term.value === "true"}
      onChange={(e) => setTerm(factory.literal(String(e.target.checked), xsd("boolean")))}
      aria-labelledby={labelledBy}
    />
  );
}
