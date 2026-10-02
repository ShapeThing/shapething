import { Fragment, type ReactNode } from "react";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Splits `text` on every case-insensitive occurrence of `query` and wraps the matches in <mark>, so
// a search snippet like "amst" reads as highlighted inside a result label of "Amsterdam".
export function highlightMatches(
  text: string,
  query: string | undefined,
  className = "st-match",
): ReactNode {
  const trimmed = query?.trim();
  if (!trimmed) return text;

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, "gi"));
  if (parts.length === 1) return text;

  return parts.map((part, index) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark key={index} className={className}>
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
