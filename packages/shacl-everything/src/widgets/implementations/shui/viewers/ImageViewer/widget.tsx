import type { WidgetProps } from "@/widgets/types.ts";

export default function ImageViewer({ shape: node }: WidgetProps) {
  return <img alt={node.label()?.value} />;
}
