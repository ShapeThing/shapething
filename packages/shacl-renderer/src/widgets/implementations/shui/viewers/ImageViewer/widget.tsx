import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { resizedImageUrl } from "@/helpers/resizedImageUrl.ts";
import { st } from "@/helpers/namespaces.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

// Twice the max-height in style.css, so the image stays sharp on high density screens.
const defaultSize = { width: 1200, height: 600 };

export default function ImageViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const { enableImageResizing } = useEnvironment();
  const alt = valueNodeLabel({ term, propertyShape: shape, languages: [activeLanguage] }).value;

  // st:imageWidth: the shape knows how wide the image is shown, so it loads that width instead.
  // keepHighestInteger (constraintResolutions.ts) resolves it to a number, but st() isn't
  // literal-typed, so get()'s PredicateReturn can't know that and falls back to Term[].
  const imageWidth = shape.get(st("imageWidth")) as unknown as number | undefined;
  const size = imageWidth && imageWidth > 0 ? { width: imageWidth } : defaultSize;
  const src = enableImageResizing ? resizedImageUrl(term.value, size) : term.value;

  // The image opens in a new tab when clicked: the value itself, at full size, not the resized one.
  // Its label is shown when hovered, too (a flag says which country it is).
  return (
    <a
      className="image-viewer__link"
      href={term.value}
      title={alt}
      target="_blank"
      rel="noopener noreferrer"
    >
      <img className="image-viewer" src={src} alt={alt} />
    </a>
  );
}
