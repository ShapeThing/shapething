import Link from "@/outputs/render/components/Link/index.tsx";
import type { WidgetProps } from "@/widgets/types.ts";

export default function IRIViewer({ term }: WidgetProps) {
  if (term.termType !== "NamedNode") {
    return <span className="st-iri-viewer">{term.value}</span>;
  }

  return (
    <Link className="st-iri-viewer" href={term.value} target="_blank" rel="noopener noreferrer">
      {term.value}
    </Link>
  );
}
