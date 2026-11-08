import type { Term } from "@rdfjs/types";
import type { CSSProperties } from "react";
import { hashNumber } from "@/helpers/hashString.ts";

/**
 * A hue (0-359) of a term's own, the same every time: set as `--st-term-hue` on each value a
 * property renders (PropertyUIComponentObject, view and edit mode), so a stylesheet can give a
 * value a colour of its own, e.g. `hsl(var(--st-term-hue) 60% 85%)` for a card without a picture.
 */
export const termHue = (term: Term): number => hashNumber(`${term.termType}:${term.value}`) % 360;

export const termHueStyle = (term: Term): CSSProperties =>
  ({ "--st-term-hue": termHue(term) }) as CSSProperties;
