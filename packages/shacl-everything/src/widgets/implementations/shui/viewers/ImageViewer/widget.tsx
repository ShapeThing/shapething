import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function ImageViewer({ shape: node }: ObjectWidgetProps) {
  return <img alt={node.label()?.value} />;
}
