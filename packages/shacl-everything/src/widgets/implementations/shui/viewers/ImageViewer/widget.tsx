import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { valueNodeLabel } from "@/resolution/label.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

export default function ImageViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const alt = valueNodeLabel({ term, propertyShape: shape, languages: [activeLanguage] }).value;

  return <img className="st-image-viewer" src={term.value} alt={alt} />;
}
