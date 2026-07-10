import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function DateTimePickerEditor({ node: _node }: ObjectWidgetProps) {
  return <input type="datetime-local" />;
}
