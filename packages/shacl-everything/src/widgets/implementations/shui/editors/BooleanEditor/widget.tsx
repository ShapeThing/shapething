import { factory } from "@/helpers/factory.ts";
import { xsd } from "@/helpers/namespaces.ts";
import { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
import type { WidgetProps } from "@/widgets/types.ts";

export default function BooleanEditor({ term, setTerm, labelledBy, autoFocus }: WidgetProps) {
  const ref = useAutoFocusRef<HTMLInputElement>(autoFocus);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={term.value === "true"}
      onChange={(e) => setTerm(factory.literal(String(e.target.checked), xsd("boolean")))}
      aria-labelledby={labelledBy}
    />
  );
}
