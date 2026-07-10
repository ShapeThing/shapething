import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function DatePickerEditor({ node: _node }: ObjectWidgetProps) {
  return <input type="date" />;
}
