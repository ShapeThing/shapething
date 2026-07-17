import type { WidgetProps } from "@/widgets/types.ts";

export default function BooleanEditor({ shape }: WidgetProps) {
  return <input type="checkbox" />;
}
