import type PhotoSwipe from "photoswipe";
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
 * Opens the big version of an image in PhotoSwipe, zooming from its thumbnail (and back when it is
 * closed). `anchor` is the link to the original around it (see widget.tsx).
 *
 * The images are in a modal: a native <dialog>, in the top layer, so PhotoSwipe is put inside the
 * dialog to be shown on top of it, and Escape only closes PhotoSwipe, not the dialog as well.
 */
export const openLightbox = async (anchor: HTMLAnchorElement, thumbnail: HTMLImageElement) => {
  const [{ default: PhotoSwipe }] = await Promise.all([
    import("photoswipe"),
    import("photoswipe/style.css"),
    import("./lightbox.scss"),
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
  keepCornersRound(pswp);
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

// The radius of the corners of the image, on the screen (lightbox.scss has the same).
const cornerRadius = 16;

/**
 * Keeps the corners of the image in the lightbox at the same radius on the screen. PhotoSwipe
 * scales the image with a transform: while it zooms from the thumbnail and back, when zoomed in,
 * and the placeholder (the thumbnail, at its own small size) is scaled up to the size of the big
 * version. A border-radius is scaled along, so the corners would grow and shrink. While the
 * lightbox is open, the radius is set every frame to what gives cornerRadius on the screen.
 */
const keepCornersRound = (pswp: PhotoSwipe) => {
  let frame = requestAnimationFrame(function update() {
    for (const img of pswp.element?.querySelectorAll<HTMLElement>(".pswp__img") ?? []) {
      const onScreen = img.getBoundingClientRect().width;
      if (!onScreen || !img.offsetWidth) continue;
      img.style.borderRadius = `${(cornerRadius * img.offsetWidth) / onScreen}px`;
    }
    frame = requestAnimationFrame(update);
  });
  pswp.on("destroy", () => cancelAnimationFrame(frame));
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
