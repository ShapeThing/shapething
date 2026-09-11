// Refcounted <link rel="stylesheet"> injection backing st:cssImport (see resolution/cssImports.ts
// and outputs/render/hooks/useCssImports.ts). Several rendered nodes - or several mounts of the
// same one, e.g. two ChoiceElement branches both resolving to the same node shape - can acquire
// the same href concurrently, so one shared <link> is reused and only removed from <head> once
// every acquirer has released it, rather than each mount fighting over its own tag.
const refCounts = new Map<string, number>();
const linkElements = new Map<string, HTMLLinkElement>();

/**
 * Ensures a `<link rel="stylesheet" href={href}>` is present in `document.head`, creating it on
 * the first (concurrent) acquisition. Returns a release function - call it exactly once (repeat
 * calls are no-ops) when this acquirer no longer needs the stylesheet; the `<link>` is removed
 * once the refcount reaches zero.
 */
export function acquireStylesheet(href: string): () => void {
  const count = refCounts.get(href) ?? 0;
  refCounts.set(href, count + 1);

  if (count === 0) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.stCssImport = href;
    document.head.appendChild(link);
    linkElements.set(href, link);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const remaining = (refCounts.get(href) ?? 1) - 1;
    if (remaining <= 0) {
      refCounts.delete(href);
      linkElements.get(href)?.remove();
      linkElements.delete(href);
    } else {
      refCounts.set(href, remaining);
    }
  };
}
