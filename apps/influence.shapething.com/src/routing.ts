import { useMemo, useSyncExternalStore } from "react";

/**
 * The URL is the state of the app:
 * - the path is the chain of opened people, as Wikidata identifiers: /Q859,Q868
 * - the hash is the modal: #Q868 for an entity, #info for the explanation of the app
 */

const NAVIGATE_EVENT = "influence:navigate";

const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
  window.addEventListener(NAVIGATE_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("hashchange", callback);
    window.removeEventListener(NAVIGATE_EVENT, callback);
  };
};

const getSnapshot = () => `${window.location.pathname}${window.location.hash}`;

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const idsFromPath = (pathname: string): string[] =>
  pathname.slice(1).split(",").map(decode).filter(Boolean);

export type AppLocation = {
  /** The identifiers in the path, as written (old URLs may have Wikipedia titles). */
  ids: string[];
  /** The hash without the "#". */
  modal: string;
};

export const useAppLocation = (): AppLocation => {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => {
    const url = new URL(snapshot, window.location.origin);
    return { ids: idsFromPath(url.pathname), modal: decode(url.hash.slice(1)) };
  }, [snapshot]);
};

export const navigate = (href: string, { replace = false } = {}) => {
  if (replace) window.history.replaceState(null, "", href);
  else window.history.pushState(null, "", href);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
};

export const pathForIds = (ids: readonly string[]) => `/${ids.join(",")}`;

/** The current URL without the modal. */
export const withoutModal = () => `${window.location.pathname}${window.location.search}`;
