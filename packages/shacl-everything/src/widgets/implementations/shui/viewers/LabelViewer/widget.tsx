import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { valueNodeLabel } from "@/resolution/label.ts";
import type { WidgetProps } from "@/widgets/types.ts";

/**
 * A value node's resolved display label (see resolution/label.ts's valueNodeLabel - shui:LabelRole,
 * then rdfs:label, falling back to a local name) - as a hyperlink when the value is an IRI, plain
 * text otherwise. The label is content, not chrome (it names the actual value being viewed, e.g.
 * an Organization's own name), so it follows content language rather than interface language.
 */
export default function LabelViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const label = valueNodeLabel({ term, propertyShape: shape, languages: [activeLanguage] }).value;

  if (term.termType !== "NamedNode") {
    return <span className="st-label-viewer">{label}</span>;
  }

  return (
    <a className="st-label-viewer" href={term.value} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}
