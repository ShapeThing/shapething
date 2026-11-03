import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { resizedImageUrl } from "@/helpers/resizedImageUrl.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

// Twice the max-height in style.css, so the image stays sharp on high density screens.
const resizedSize = { width: 1200, height: 600 };

export default function ImageViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const { enableImageResizing } = useEnvironment();
  const alt = valueNodeLabel({ term, propertyShape: shape, languages: [activeLanguage] }).value;
  const src = enableImageResizing ? resizedImageUrl(term.value, resizedSize) : term.value;

  return <img className="image-viewer" src={src} alt={alt} />;
}
