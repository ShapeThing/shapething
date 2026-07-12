import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function DateTimePickerEditor({ shape }: ObjectWidgetProps) {
  return <input type="datetime-local" />;
}
