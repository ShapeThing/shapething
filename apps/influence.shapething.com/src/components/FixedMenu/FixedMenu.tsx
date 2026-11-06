import { useEffect, useState } from "react";
import { addBookmark, removeBookmark, useBookmarks } from "../../bookmarks.ts";
import "./style.scss";

type Feedback = "added" | "removed" | undefined;

/**
 * The info, start over and bookmark buttons of the columns page. Give it the path as key too: a
 * message about one path does not belong to the next.
 */
export default function FixedMenu({ path }: { path: string }) {
  const bookmarks = useBookmarks();
  const isBookmarked = bookmarks.includes(path);
  const [feedback, setFeedback] = useState<Feedback>();

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(undefined), 1500);
    return () => clearTimeout(timeout);
  }, [feedback]);

  return (
    <nav className="fixed-menu" aria-label="Menu">
      <a className="fixed-button fixed-button--info" href="#info">
        <span className="fixed-button__icon" aria-hidden="true" />
        <span className="visually-hidden">About this app</span>
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
    </nav>
  );
}
