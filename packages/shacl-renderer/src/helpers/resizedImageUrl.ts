// Hosts wsrv.nl can not reach, so images on them are always loaded directly.
const localHosts =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]$|.*\.local$)/;

// Wikimedia Commons "Special:FilePath" URLs (what Wikidata's image property, P18, links to) point at
// the full original. Commons makes thumbnails itself, but only serves these widths from its cache;
// other widths are rendered on demand and rate limited.
const commonsFilePath = /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//;
const commonsWidths = [120, 250, 330, 500, 960, 1280, 1920];

/**
 * How the image is fitted into width x height (wsrv.nl's `fit`): "inside" keeps all of it,
 * "cover" crops it to fill the box, "contain" pads it. Commons thumbnails are only ever resized to
 * the width (the CSS object-fit of the image does the rest), so it has no effect on those.
 */
export type ImageFit = "inside" | "cover" | "contain";

/**
 * The URL of an image resized to fit width x height (or just width, when no height is given), so
 * a large photo is not downloaded in full to be shown at a few hundred pixels.
 *
 * A Wikimedia Commons image is asked from Commons at the smallest standard thumbnail width that is
 * at least `width`. Any other remote image goes through https://wsrv.nl, an open source image cache
 * and resize service, and is never enlarged. Images wsrv.nl can not fetch or would not improve -
 * data and blob URLs, local hosts and SVGs, which are vector already - keep their own URL.
 *
 * When wsrv.nl can not fetch the image (the host is down, or rate limits wsrv.nl, as Wikimedia
 * does at times), `default=1` makes it redirect to the original URL instead of answering with an
 * error, so the image is still shown, just not resized.
 */
export function resizedImageUrl(
  url: string,
  { width, height, fit = "inside" }: { width: number; height?: number; fit?: ImageFit },
) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (commonsFilePath.test(url)) {
    const commonsWidth =
      commonsWidths.find((standard) => standard >= width) ??
      commonsWidths[commonsWidths.length - 1];
    parsed.protocol = "https:";
    parsed.search = new URLSearchParams({ width: String(commonsWidth) }).toString();
    return parsed.href;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return url;
  if (localHosts.test(parsed.hostname)) return url;
  if (parsed.pathname.toLowerCase().endsWith(".svg")) return url;
  if (parsed.hostname === "wsrv.nl") return url;

  const params = new URLSearchParams({ url, w: String(width) });
  if (height !== undefined) params.set("h", String(height));
  params.set("fit", fit);
  params.set("we", "");
  params.set("default", "1");
  return `https://wsrv.nl/?${params}`;
}
