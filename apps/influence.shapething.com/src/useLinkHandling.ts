import { useEffect } from "react";
import { entityId } from "./data/entities.ts";
import { navigate } from "./routing.ts";

const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/**
 * Turns clicks on links into navigation within the app:
 * - a link to a path of the app is followed without loading the page again,
 * - a link to a Wikidata item (the works, interests and ideas shui:LabelViewer shows) opens that
 *   item in the modal instead of on Wikidata.
 * Clicks with a modifier key still open the link in a new tab or window, as usual.
 */
export const useLinkHandling = () => {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !isPlainClick(event)) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const id = entityId(anchor.href);
      if (id) {
        event.preventDefault();
        window.location.hash = id;
        return;
      }

      const url = new URL(anchor.href);
      const isAppPath =
        url.origin === window.location.origin && !anchor.target && !anchor.hasAttribute("download");
      const isOnlyHashChange = url.pathname === window.location.pathname && url.hash !== "";
      if (isAppPath && !isOnlyHashChange) {
        event.preventDefault();
        navigate(`${url.pathname}${url.search}${url.hash}`);
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
};
