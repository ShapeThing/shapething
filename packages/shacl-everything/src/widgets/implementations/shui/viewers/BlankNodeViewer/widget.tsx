import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import { valueNodeLabel } from "@/resolution/label.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

/**
 * 10.2.1: a human-readable label of the blank node - the same shui:LabelRole/rdfs:label
 * resolution every other value-node label goes through (resolution/label.ts's valueNodeLabel).
 * The label is content, not chrome, so it follows content language.
 */
export default function BlankNodeViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();

  const label = useReactiveRead(
    shape.dataGraph,
    `blank-node-viewer-label@${term.value}@${activeLanguage}`,
    () => valueNodeLabel({ term, propertyShape: shape, languages: [activeLanguage] }),
  );

  if (label.value === "") return null;

  return <span className="st-blank-node-viewer__label">{label.value}</span>;
}
