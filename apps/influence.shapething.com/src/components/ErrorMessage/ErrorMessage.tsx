import { clsx } from "../../clsx.ts";
import "./style.scss";

/**
 * Wikidata or Wikipedia did not answer. Their query services are often only busy for a moment,
 * so the message offers to ask again.
 */
export default function ErrorMessage({
  onRetry,
  className,
  children = "Unfortunately the data source is unavailable at the moment.",
}: {
  onRetry: () => void;
  className?: string;
  children?: string;
}) {
  return (
    <p className={clsx("error-message", className)} role="alert">
      {children}{" "}
      <button type="button" className="error-message__retry" onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}
