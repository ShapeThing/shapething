import { useMemo, useSyncExternalStore } from "react";
import { parseSegment, segmentsFor, type Sorts, sortsFromSegments } from "./sorting.ts";

/**
 * The URL is the state of the app:
 * - the path is the chain of opened people, as Wikidata identifiers: /Q859,Q868, with the sort
 *   orders of the columns beside the person they belong to: /n:Q859:b,Q868 (see sorting.ts)
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

const getSnapshot = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const segmentsFromPath = (pathname: string) =>
  pathname.slice(1).split(",").map(decode).filter(Boolean).map(parseSegment);

export const idsFromPath = (pathname: string): string[] =>
  segmentsFromPath(pathname).map((segment) => segment.id);

export type AppLocation = {
  /** The identifiers in the path, as written (old URLs may have Wikipedia titles). */
  ids: string[];
  /** The hash without the "#". */
  modal: string;
  /** How the columns are sorted, by column key (see sorting.ts). */
  sorts: Sorts;
};

export const useAppLocation = (): AppLocation => {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => {
    const url = new URL(snapshot, window.location.origin);
    return {
      ids: idsFromPath(url.pathname),
      modal: decode(url.hash.slice(1)),
      sorts: sortsFromSegments(segmentsFromPath(url.pathname)),
    };
  }, [snapshot]);
};

type HistoryState = {
  /** The entry was opened from a link inside the entity modal: the modal can go back to the
   * entity before it (see EntityModal). */
  fromModal?: boolean;
};

export const navigate = (
  href: string,
  { replace = false, state = null }: { replace?: boolean; state?: HistoryState | null } = {},
) => {
  if (replace) window.history.replaceState(state, "", href);
  else window.history.pushState(state, "", href);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
};

/** Whether the current entry was opened from a link inside the entity modal. The browser keeps
 * the state with its entry, so it is right after going back and forward too. */
export const isOpenedFromModal = () =>
  (window.history.state as HistoryState | null)?.fromModal === true;

/** The path of a chain; with sort orders, those of its columns (see sorting.ts). */
export const pathForIds = (ids: readonly string[], sorts: Sorts = new Map()) =>
  `/${segmentsFor(ids, sorts).join(",")}`;

/** The current URL without the modal. */
export const withoutModal = () => `${window.location.pathname}${window.location.search}`;
