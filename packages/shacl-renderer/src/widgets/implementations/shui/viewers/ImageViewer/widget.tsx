import type { MouseEvent } from "react";
import { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useResizedImage } from "@/outputs/render/hooks/useResizedImage.ts";
import { st } from "@/helpers/namespaces.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import Link from "@/outputs/render/components/Link/index.tsx";
import { openLightbox } from "./lightbox.ts";
import "photoswipe/style.css";
import "./style.css";

// Twice the max-height in style.css, so the image stays sharp on high density screens.
const defaultSize = { width: 1200, height: 600 };

export default function ImageViewer({ shape, term }: WidgetProps) {
  const { activeLanguage } = useContentLanguage();
  const { enableImageLightbox } = useEnvironment();
  const alt = valueNodeLabel({ term, propertyShape: shape, languages: [activeLanguage] }).value;

  // st:imageWidth: the shape knows how wide the image is shown, so it loads that width instead.
  // keepHighestInteger (constraintResolutions.ts) resolves it to a number, but st() isn't
  // literal-typed, so get()'s PredicateReturn can't know that and falls back to Term[].
  const imageWidth = shape.get(st("imageWidth")) as unknown as number | undefined;
  const size = imageWidth && imageWidth > 0 ? { width: imageWidth } : defaultSize;
  // An image that does not load at all is left out (useResizedImage).
  const image = useResizedImage(term.value, size);
  if (!image) return null;

  // With enableImageLightbox, a plain click opens the image in a lightbox (lightbox.ts), as a
  // gallery of every image on the screen that has one. Clicks with a modifier key still follow the
  // link, as does a click that resolveLink's onClick already handled (Link runs that one first).
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const thumbnail = event.currentTarget.querySelector("img");
    if (!thumbnail) return;
    event.preventDefault();
    void openLightbox(event.currentTarget, thumbnail);
  };

  // The image opens in a new tab when clicked (or in the lightbox): the value itself, at full
  // size, not the resized one. Its label is shown when hovered, too (a flag says which country it
  // is).
  return (
    <Link
      className="image-viewer__link"
      href={term.value}
      title={alt}
      target="_blank"
      rel="noopener noreferrer"
      data-lightbox={enableImageLightbox || undefined}
      onClick={enableImageLightbox ? onClick : undefined}
    >
      <img className="image-viewer" src={image.src} alt={alt} onError={image.onError} />
    </Link>
  );
}
