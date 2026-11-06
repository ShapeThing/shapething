import { createContext, useContext } from "react";

/**
 * The influence counts of the people shown at the moment, the scale the relative influence of a
 * person is measured on (see widgets/RelativeInfluenceViewer).
 */
export type InfluenceScale = {
  /** Distinct counts, ascending. */
  counts: readonly number[];
};

export const createInfluenceScale = (counts: Iterable<number>): InfluenceScale => ({
  counts: [...new Set(counts)].sort((a, b) => a - b),
});

/**
 * Where `count` ranks among the counts of the scale, from 0 (the lowest) to 100 (the highest).
 * Ranking keeps a few very influential people from flattening everyone else to an empty bar.
 * Undefined when there is nothing to compare with.
 */
export const relativeInfluence = (scale: InfluenceScale, count: number): number | undefined => {
  const { counts } = scale;
  if (counts.length < 2) return undefined;
  const lower = counts.filter((other) => other < count).length;
  return Math.round((Math.min(lower, counts.length - 1) / (counts.length - 1)) * 100);
};

export const InfluenceScaleContext = createContext<InfluenceScale>(createInfluenceScale([]));

export const useInfluenceScale = () => useContext(InfluenceScaleContext);
