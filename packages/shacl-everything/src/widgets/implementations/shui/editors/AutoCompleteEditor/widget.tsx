import type { WidgetProps } from "@/widgets/types.ts";

export default function AutoCompleteEditor({ shape, term }: WidgetProps) {
  return <input type="text" value={term.value} />;
}
