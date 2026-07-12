import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function RichTextEditor({ shape }: ObjectWidgetProps) {
  return <div contentEditable role="textbox" />;
}
