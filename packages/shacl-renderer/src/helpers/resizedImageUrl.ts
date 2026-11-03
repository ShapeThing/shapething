// Hosts wsrv.nl can not reach, so images on them are always loaded directly.
const localHosts =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]$|.*\.local$)/;

/**
 * The URL of an image resized by https://wsrv.nl, an open source image cache and resize service, so
 * a large photo is not downloaded in full to be shown at a few hundred pixels. The image fits inside
 * width x height and is never enlarged. Images wsrv.nl can not fetch or would not improve - data and
 * blob URLs, local hosts and SVGs, which are vector already - keep their own URL.
 */
export function resizedImageUrl(url: string, { width, height }: { width: number; height: number }) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return url;
  if (localHosts.test(parsed.hostname)) return url;
  if (parsed.pathname.toLowerCase().endsWith(".svg")) return url;
  if (parsed.hostname === "wsrv.nl") return url;

  const params = new URLSearchParams({
    url,
    w: String(width),
    h: String(height),
    fit: "inside",
    we: "",
  });
  return `https://wsrv.nl/?${params}`;
}
