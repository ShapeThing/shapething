import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function ImageViewer({ node }: ObjectWidgetProps) {
  return <img alt={node.label()?.value} />;
}
