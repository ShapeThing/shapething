import { useState } from "react";
import { type ImageFit, resizedImageUrl } from "@/helpers/resizedImageUrl.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";

type Size = { width: number; height?: number; fit?: ImageFit };

/**
 * The one way the renderer loads an image: the `src` and `onError` for an <img> showing `url` at
 * `size`, or undefined when there is no url or nothing of it loads.
 *
 * With enableImageResizing, the image is resized (helpers/resizedImageUrl.ts). A resized image
 * that does not load is tried at its original URL. wsrv.nl already redirects to the original when
 * it can not fetch the image (`default=1`), so this covers wsrv.nl itself being unreachable. An
 * image that does not load at all (gone, or a URL made from an identifier, such as a cover that
 * may not exist) gives undefined, so the caller leaves it out rather than showing it broken.
 */
export function useResizedImage(url: string | undefined, size: Size) {
  const { enableImageResizing } = useEnvironment();
  // The URLs that failed: keyed by URL, so another url (another value) starts afresh.
  const [failed, setFailed] = useState<string[]>([]);
  if (!url) return undefined;

  const candidates = enableImageResizing ? [resizedImageUrl(url, size), url] : [url];
  const src = candidates.find((candidate) => !failed.includes(candidate));
  if (!src) return undefined;

  return { src, onError: () => setFailed((previous) => [...previous, src]) };
}
