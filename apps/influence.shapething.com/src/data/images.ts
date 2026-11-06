// Wikimedia Commons only serves thumbnails efficiently (and without rate limiting) at these widths.
const COMMONS_WIDTHS = [120, 250, 330, 500, 960, 1280, 1920];

const COMMONS_FILE_PATH = /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//;

/**
 * Wikidata images (P18) are Commons "Special:FilePath" URLs of the full original, which can be many
 * megabytes. This asks Commons for a thumbnail of at least `width` pixels instead. Other URLs are
 * returned unchanged.
 */
export const commonsThumbnail = (url: string, width: number): string => {
  if (!COMMONS_FILE_PATH.test(url)) return url;
  const standardWidth =
    COMMONS_WIDTHS.find((standard) => standard >= width) ??
    COMMONS_WIDTHS[COMMONS_WIDTHS.length - 1];
  return `${url.replace(/^http:/, "https:").split("?")[0]}?width=${standardWidth}`;
};
