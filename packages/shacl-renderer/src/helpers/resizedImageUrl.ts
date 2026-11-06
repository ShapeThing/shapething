// Hosts wsrv.nl can not reach, so images on them are always loaded directly.
const localHosts =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]$|.*\.local$)/;

// Wikimedia Commons "Special:FilePath" URLs (what Wikidata's image property, P18, links to) point at
// the full original. Commons makes thumbnails itself, but only serves these widths from its cache;
// other widths are rendered on demand and rate limited.
const commonsFilePath = /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//;
const commonsWidths = [120, 250, 330, 500, 960, 1280, 1920];

/**
 * The URL of an image resized to fit inside width x height (or just width, when no height is
 * given), so a large photo is not downloaded in full to be shown at a few hundred pixels.
 *
 * A Wikimedia Commons image is asked from Commons at the smallest standard thumbnail width that is
 * at least `width`. Any other remote image goes through https://wsrv.nl, an open source image cache
 * and resize service, and is never enlarged. Images wsrv.nl can not fetch or would not improve -
 * data and blob URLs, local hosts and SVGs, which are vector already - keep their own URL.
 */
export function resizedImageUrl(
  url: string,
  { width, height }: { width: number; height?: number },
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
  params.set("fit", "inside");
  params.set("we", "");
  return `https://wsrv.nl/?${params}`;
}
