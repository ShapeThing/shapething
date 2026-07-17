import type { WidgetProps } from "@/widgets/types.ts";

export default function RichTextEditor({ shape }: WidgetProps) {
  return <div contentEditable role="textbox" />;
}
