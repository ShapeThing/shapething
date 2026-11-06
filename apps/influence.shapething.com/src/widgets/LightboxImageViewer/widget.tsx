import { defaultWidgets, type WidgetProps } from "@shapething/shacl-renderer";
import type { MouseEvent } from "react";
import { openLightbox } from "./lightbox.ts";

const ImageViewer = defaultWidgets.viewers.ImageViewer.Component;

/**
 * shui:ImageViewer, with the big version of the image in a lightbox. The bundled viewer links the
 * image to its original (a.image-viewer__link); a plain click on that link opens the lightbox
 * instead of a new tab. Clicks with a modifier key still open the link as usual. An image inside an
 * st:href link (a portrait that opens the modal) has no link of its own, so it is left alone.
 */
export default function LightboxImageViewer(props: WidgetProps) {
  const onClick = (event: MouseEvent<HTMLSpanElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const anchor = (event.target as Element).closest("a.image-viewer__link");
    const thumbnail = anchor?.querySelector("img");
    if (!(anchor instanceof HTMLAnchorElement) || !thumbnail) return;
    if (!event.currentTarget.contains(anchor)) return;
    event.preventDefault();
    void openLightbox(anchor, thumbnail);
  };

  return (
    <span className="lightbox-image-viewer" onClick={onClick}>
      <ImageViewer {...props} />
    </span>
  );
}
