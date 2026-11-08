import { useEffect, useState } from "react";
import { addBookmark, removeBookmark, useBookmarks } from "../../bookmarks.ts";
import "./style.scss";

type Feedback = "added" | "removed" | undefined;

/**
 * Shares the current chain: the share sheet of the device, or else the link on the clipboard.
 * Resolves to whether the link was copied, so the button can say so (a share sheet speaks for
 * itself).
 */
const shareLink = async (): Promise<boolean> => {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, url });
      return false;
    } catch (error) {
      // Closing the share sheet is not a reason to copy the link instead.
      if (error instanceof DOMException && error.name === "AbortError") return false;
    }
  }
  await navigator.clipboard.writeText(url);
  return true;
};

/**
 * The info, timeline, start over, bookmark and share buttons of the columns page. Give it the path as key too: a
 * message about one path does not belong to the next.
 */
export default function FixedMenu({ path }: { path: string }) {
  const bookmarks = useBookmarks();
  const isBookmarked = bookmarks.includes(path);
  const [feedback, setFeedback] = useState<Feedback>();
  const [shareFeedback, setShareFeedback] = useState<"copied" | "failed">();

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(undefined), 1500);
    return () => clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!shareFeedback) return;
    const timeout = setTimeout(() => setShareFeedback(undefined), 1500);
    return () => clearTimeout(timeout);
  }, [shareFeedback]);

  return (
    <nav className="fixed-menu" aria-label="Menu">
      <a className="fixed-button fixed-button--info" href="#info">
        <span className="fixed-button__icon" aria-hidden="true" />
        <span className="visually-hidden">About this app</span>
      </a>

      <a className="fixed-button fixed-button--timeline" href="#timeline">
        <span className="fixed-button__icon" aria-hidden="true" />
        <span className="visually-hidden">Timeline of this chain</span>
      </a>

      <a className="fixed-button fixed-button--restart" href="/">
        <span className="fixed-button__icon" aria-hidden="true" />
        <span className="visually-hidden">Start over</span>
      </a>

      <button
        type="button"
        className="fixed-button fixed-button--bookmark"
        data-state={feedback ?? (isBookmarked ? "bookmarked" : "default")}
        aria-pressed={isBookmarked}
        onClick={() => {
          if (isBookmarked) {
            removeBookmark(path);
            setFeedback("removed");
          } else {
            addBookmark(path);
            setFeedback("added");
          }
        }}
      >
        <span className="fixed-button__text" aria-live="polite">
          {feedback === "added"
            ? "Bookmark added"
            : feedback === "removed"
              ? "Bookmark removed"
              : ""}
        </span>
        <span className="fixed-button__icon" aria-hidden="true" />
        <span className="visually-hidden">Bookmark</span>
      </button>

      <button
        type="button"
        className="fixed-button fixed-button--share"
        data-state={shareFeedback ?? "default"}
        onClick={() => {
          shareLink().then(
            (copied) => copied && setShareFeedback("copied"),
            () => setShareFeedback("failed"),
          );
        }}
      >
        <span className="fixed-button__text" aria-live="polite">
          {shareFeedback === "copied"
            ? "Link copied"
            : shareFeedback === "failed"
              ? "Could not copy the link"
              : ""}
        </span>
        <span className="fixed-button__icon" aria-hidden="true" />
        <span className="visually-hidden">Share this chain</span>
      </button>
    </nav>
  );
}
