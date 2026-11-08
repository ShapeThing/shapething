import { useEffect } from "react";
import { navigate } from "./routing.ts";

const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/**
 * Follows a link to a path of the app without loading the page again. Clicks with a modifier key
 * still open the link in a new tab or window, as usual. (The links of the displays to Wikidata
 * items already point at the modal, see Display; one followed from inside the modal is marked in
 * the history, so the modal can go back, see EntityModal.)
 */
export const useLinkHandling = () => {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !isPlainClick(event)) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const url = new URL(anchor.href);
      const isAppPath =
        url.origin === window.location.origin && !anchor.target && !anchor.hasAttribute("download");
      const isOnlyHashChange = url.pathname === window.location.pathname && url.hash !== "";
      if (isAppPath && !isOnlyHashChange) {
        event.preventDefault();
        navigate(`${url.pathname}${url.search}${url.hash}`);
      } else if (
        isAppPath &&
        url.hash !== window.location.hash &&
        anchor.closest(".entity-modal")
      ) {
        // A link from one entity in the modal to another: marked, so the modal shows a back button.
        event.preventDefault();
        navigate(url.hash, { state: { fromModal: true } });
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
};
