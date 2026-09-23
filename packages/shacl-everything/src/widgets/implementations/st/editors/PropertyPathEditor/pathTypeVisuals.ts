import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

// Which path types get an icon/color badge, and the CSS class that draws it - both the glyph
// (a `::before` content) and the fill color live on that class in style.css, so there's exactly
// one place to change either. Shared by the rendered path tree (widget.tsx) and PathItemModal's
// "Path type" select. "predicate"/"sequence" have no entry - neither gets a badge.
export const PATH_TYPE_BADGE: Partial<Record<PropertyPath["type"], string>> = {
  alternative: "st-alternative-icon",
  inverse: "st-inverse-icon",
  zeroOrMore: "st-zero-or-more-icon",
  oneOrMore: "st-one-or-more-icon",
  zeroOrOne: "st-zero-or-one-icon",
  sequence: "st-sequence-icon",
};
