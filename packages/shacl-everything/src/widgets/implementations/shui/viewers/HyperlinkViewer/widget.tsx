import type { WidgetProps } from "@/widgets/types.ts";

export default function HyperlinkViewer({ term }: WidgetProps) {
  return (
    <a className="st-hyperlink-viewer" href={term.value} target="_blank" rel="noopener noreferrer">
      {term.value}
    </a>
  );
}
