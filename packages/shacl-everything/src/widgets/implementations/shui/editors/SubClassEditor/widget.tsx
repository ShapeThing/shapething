import type { WidgetProps } from "@/widgets/types.ts";

export default function SubClassEditor({ shape }: WidgetProps) {
  return (
    <span className="st-select-wrapper">
      <select className="st-select" />
      <span className="st-select-arrow" aria-hidden="true" />
    </span>
  );
}
