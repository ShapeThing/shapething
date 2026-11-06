import { useEffect } from "react";

const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Wikimedia Commons "Special:FilePath" URLs (wdt:P18, wdt:P41) point at the full original, which
// can be tens of megabytes. Commons serves a thumbnail of 1920px wide from its cache instead (or the
// original, when that is smaller).
const commonsFilePath = /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//;
const largeWidth = 1920;

const largeImageUrl = (url: string) => {
  if (!commonsFilePath.test(url) || url.toLowerCase().endsWith(".svg")) return url;
  const parsed = new URL(url);
  parsed.protocol = "https:";
  parsed.search = new URLSearchParams({ width: String(largeWidth) }).toString();
  return parsed.href;
};

/**
 * Opens the big version of an image in PhotoSwipe when it is clicked. The shui:ImageViewer wraps
 * each image in a link to the original (a.image-viewer__link); a plain click on it opens the
 * lightbox instead of a new tab, also when the image is inside another link (a search result).
 * Clicks with a modifier key still open the link as usual. The image zooms from the thumbnail into
 * the lightbox, and back when it is closed.
 *
 * The images are in a modal: a native <dialog>, in the top layer, so PhotoSwipe is put inside the
 * dialog to be shown on top of it, and Escape only closes PhotoSwipe, not the dialog as well.
 */
export const useImageLightbox = () => {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !isPlainClick(event)) return;
      const anchor = (event.target as Element | null)?.closest?.("a.image-viewer__link");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const thumbnail = anchor.querySelector("img");
      if (!thumbnail) return;

      event.preventDefault();
      void openLightbox(anchor, thumbnail);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
};

const openLightbox = async (anchor: HTMLAnchorElement, thumbnail: HTMLImageElement) => {
  const [{ default: PhotoSwipe }] = await Promise.all([
    import("photoswipe"),
    import("photoswipe/style.css"),
  ]);

  // PhotoSwipe needs the size of the image before it is loaded, so the big version is loaded first.
  // When that takes long, the lightbox opens anyway, with the size estimated from the thumbnail
  // (shown until the big version is there), and the size is corrected once it has loaded.
  const ratio =
    thumbnail.naturalWidth && thumbnail.naturalHeight
      ? thumbnail.naturalHeight / thumbnail.naturalWidth
      : 1;
  const item = {
    src: largeImageUrl(anchor.href),
    msrc: thumbnail.currentSrc || thumbnail.src,
    alt: thumbnail.alt,
    width: largeWidth,
    height: Math.round(largeWidth * ratio),
  };

  const large = new Image();
  const loaded = new Promise<boolean>((resolve) => {
    large.onload = () => resolve(large.naturalWidth > 0);
    large.onerror = () => resolve(false);
  });
  large.src = item.src;
  const loadedInTime = await Promise.race([
    loaded,
    new Promise<false>((resolve) => setTimeout(resolve, 400, false)),
  ]);
  if (loadedInTime) Object.assign(item, { width: large.naturalWidth, height: large.naturalHeight });

  const dialog = anchor.closest("dialog[open]");
  const keepDialogOpen = (event: Event) => event.preventDefault();
  dialog?.addEventListener("cancel", keepDialogOpen);

  const pswp = new PhotoSwipe({
    dataSource: [item],
    appendToEl: dialog instanceof HTMLElement ? dialog : document.body,
    bgOpacity: 0.9,
    showHideAnimationType: "zoom",
  });
  pswp.addFilter("thumbBounds", () => renderedImageBounds(thumbnail, item.width, item.height));
  pswp.on("destroy", () => dialog?.removeEventListener("cancel", keepDialogOpen));
  pswp.init();
  if (loadedInTime) return;

  // Refreshing the slide while it zooms in would cut the animation short, so it waits for the end.
  const opened = new Promise<void>((resolve) => pswp.on("openingAnimationEnd", () => resolve()));
  const [isLoaded] = await Promise.all([loaded, opened]);
  if (!isLoaded || pswp.isDestroying) return;
  if (large.naturalWidth === item.width && large.naturalHeight === item.height) return;
  Object.assign(item, { width: large.naturalWidth, height: large.naturalHeight });
  pswp.refreshSlideContent(0);
};

/** One value of object-position (a percentage or a length) as an offset in pixels. */
const objectOffset = (value: string | undefined, free: number) => {
  if (!value) return free / 2;
  if (value.endsWith("%")) return (free * parseFloat(value)) / 100;
  return parseFloat(value) || 0;
};

/**
 * Where the image is on the screen, for the zoom animation. The thumbnails are shown with
 * object-fit: a round portrait is cropped (cover), the image in the modal is fitted into its column
 * (contain). PhotoSwipe only knows the box of the element, so the image is placed inside it the way
 * object-fit and object-position do; a cropped image gets the visible part as its innerRect.
 */
const renderedImageBounds = (img: HTMLImageElement, width: number, height: number) => {
  const rect = img.getBoundingClientRect();
  const style = getComputedStyle(img);
  const fit = style.objectFit;
  if (!width || !height || fit === "fill" || fit === "") {
    return { x: rect.left, y: rect.top, w: rect.width };
  }

  // cover fills the box, contain (and scale-down, for these thumbnails) fits inside it.
  const scales = [rect.width / width, rect.height / height];
  const scale = fit === "cover" ? Math.max(...scales) : Math.min(...scales);

  const [positionX, positionY] = style.objectPosition.split(" ");
  const offsetX = objectOffset(positionX, rect.width - width * scale);
  const offsetY = objectOffset(positionY, rect.height - height * scale);
  const bounds = { x: rect.left + offsetX, y: rect.top + offsetY, w: width * scale };

  // Contained: the whole image is visible, so it zooms from exactly there.
  if (offsetX >= 0 && offsetY >= 0) return bounds;
  return { ...bounds, innerRect: { x: offsetX, y: offsetY, w: rect.width, h: rect.height } };
};
