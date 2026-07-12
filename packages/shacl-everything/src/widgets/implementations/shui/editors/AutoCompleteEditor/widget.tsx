import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function AutoCompleteEditor({ shape, term }: ObjectWidgetProps) {
  return <input type="text" value={term.value} />;
}
