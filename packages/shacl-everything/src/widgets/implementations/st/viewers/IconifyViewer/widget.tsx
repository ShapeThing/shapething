import { Icon } from "@iconify/react";
import type { WidgetProps } from "@/widgets/types.ts";

export default function IconifyViewer({ term }: WidgetProps) {
  return <Icon className="st-iconify-viewer" icon={term.value} />;
}
