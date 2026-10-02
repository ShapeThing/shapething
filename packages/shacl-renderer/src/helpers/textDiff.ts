export type TextDiffSegment = { type: "same" | "added" | "removed"; text: string };

// Words, runs of whitespace and single punctuation marks - the units a change is shown in, so
// "the quick fox" -> "the slow fox" marks "quick"/"slow" rather than individual letters.
const TOKEN = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;

// Past this many token pairs the LCS table gets too big to build for an inline diff - the whole
// old text is then shown removed and the whole new text added instead.
const MAX_CELLS = 250_000;

/**
 * A word-level diff of `before` -> `after` (longest common subsequence over TOKENs), as the
 * segments to render in order: unchanged text, and what was removed/added in between. Adjacent
 * segments of the same type are merged.
 */
export function textDiff(before: string, after: string): TextDiffSegment[] {
  const a = before.match(TOKEN) ?? [];
  const b = after.match(TOKEN) ?? [];
  if (a.length * b.length > MAX_CELLS) {
    return merge([
      { type: "removed", text: before },
      { type: "added", text: after },
    ]);
  }

  // lcs[i][j]: length of the longest common subsequence of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const segments: TextDiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      segments.push({ type: "same", text: a[i++] });
      j++;
    } else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
      // Removals before additions at the same spot - "old new", the usual reading order.
      segments.push({ type: "removed", text: a[i++] });
    } else {
      segments.push({ type: "added", text: b[j++] });
    }
  }
  return merge(segments);
}

function merge(segments: TextDiffSegment[]): TextDiffSegment[] {
  const merged: TextDiffSegment[] = [];
  for (const segment of segments) {
    if (segment.text === "") continue;
    const last = merged.at(-1);
    if (last?.type === segment.type) last.text += segment.text;
    else merged.push({ ...segment });
  }
  return merged;
}
