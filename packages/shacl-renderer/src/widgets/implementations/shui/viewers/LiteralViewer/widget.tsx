import type { WidgetProps } from "@/widgets/types.ts";

export default function LiteralViewer({ term }: WidgetProps) {
  return <span className="st-literal-viewer">{term.value}</span>;
}
