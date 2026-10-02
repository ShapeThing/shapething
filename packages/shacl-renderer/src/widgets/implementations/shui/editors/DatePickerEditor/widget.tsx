import TextFieldEditor from "@/widgets/implementations/shui/editors/TextFieldEditor/widget.tsx";
import type { WidgetProps } from "@/widgets/types.ts";

export default function DatePickerEditor(props: WidgetProps) {
  return <TextFieldEditor type="date" {...props} />;
}
