import type { WidgetProps } from "@/widgets/types.ts";

export default function DateTimePickerEditor({ shape }: WidgetProps) {
  return <input type="datetime-local" />;
}
