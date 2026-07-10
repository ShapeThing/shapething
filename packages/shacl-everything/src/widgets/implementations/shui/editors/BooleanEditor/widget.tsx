import type { ObjectWidgetProps } from "@/widgets/types.ts";

export default function BooleanEditor({ node: _node }: ObjectWidgetProps) {
  return <input type="checkbox" />;
}
