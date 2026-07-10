import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function RichTextEditor({ node: _node }: ObjectWidgetProps) {
  return <div contentEditable role="textbox" />;
}
