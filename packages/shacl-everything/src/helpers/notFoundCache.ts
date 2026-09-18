const STORAGE_KEY_PREFIX = "shapething:rdf-404:";

// A remembered 404 expires rather than being permanent: the URL might be this app's own
// same-origin dev fixture (e.g. a shapes file still being authored) that exists again minutes
// later, or a third-party host that was only briefly down. An indefinite cache would keep
// reporting a URL as gone long after it started working again, with no way for a developer to
// tell why a page they just fixed still won't load short of clearing localStorage by hand.
const TTL_MS = 5 * 60 * 1000;

// localStorage is unavailable outside a browser (SSR, Node test runs) and can throw in a
// locked-down browser context (privacy mode, sandboxed iframe with storage disabled, quota
// errors) - this cache is a pure optimization, so any failure to read or write it is swallowed
// and treated as "unknown"/a no-op rather than surfaced.
export const isKnownNotFound = (href: string): boolean => {
  try {
    const recordedAt = localStorage.getItem(STORAGE_KEY_PREFIX + href);
    return recordedAt !== null && Date.now() - Number(recordedAt) < TTL_MS;
  } catch {
    return false;
  }
};

export const rememberNotFound = (href: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + href, String(Date.now()));
  } catch {
    // best-effort only, see isKnownNotFound
  }
};
