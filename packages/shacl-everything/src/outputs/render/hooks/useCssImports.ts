import { useEffect } from "react";
import { acquireStylesheet } from "@/helpers/stylesheetRegistry.ts";

/**
 * Loads every href in `hrefs` as a `<link rel="stylesheet">` (see helpers/stylesheetRegistry.ts)
 * for as long as this component stays mounted with that same `hrefs` reference, releasing them on
 * unmount or when `hrefs` changes. Callers are expected to memoize `hrefs` (e.g. NodeUIComponent
 * derives it from its own memoized NodeUIElement) so an unrelated re-render doesn't churn the
 * `<link>` tags out and back in.
 */
export function useCssImports(hrefs: readonly string[]): void {
  useEffect(() => {
    const releases = hrefs.map((href) => acquireStylesheet(href));
    return () => {
      for (const release of releases) release();
    };
  }, [hrefs]);
}
