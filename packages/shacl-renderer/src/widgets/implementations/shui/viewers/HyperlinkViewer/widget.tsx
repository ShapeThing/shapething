import Link from "@/outputs/render/components/Link/index.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function HyperlinkViewer({ term }: WidgetProps) {
  return (
    <Link
      className="st-hyperlink-viewer"
      href={term.value}
      target="_blank"
      rel="noopener noreferrer"
    >
      {term.value}
    </Link>
  );
}
