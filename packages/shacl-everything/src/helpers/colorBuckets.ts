const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export type ColorBucket =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "pink"
  | "white"
  | "gray"
  | "black";

// Rendering/iteration order - roughly hue-sorted with the achromatic buckets last, rather than
// alphabetical or count-sorted, so the circle row reads like a small rainbow.
export const COLOR_BUCKET_ORDER: ColorBucket[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "pink",
  "white",
  "gray",
  "black",
];

// One fixed, canonical swatch per bucket - shown on every circle regardless of which exact shade a
// member value happens to be, so a bucket's circle color stays stable across datasets/queries
// instead of depending on whichever value the data happened to contain (e.g. via SAMPLE()).
export const COLOR_BUCKET_SWATCH: Record<ColorBucket, string> = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  white: "#ffffff",
  gray: "#9ca3af",
  black: "#000000",
};

// Genuine CSS HSL notation: h in degrees [0, 360), s/l as percentages [0, 100] - the actual
// st:hue/st:saturation/st:lightness triples st:ColorEditor writes and st:ColorViewer/st:ColorFacet
// read, not a derived encoding of any kind.
export type Hsl = { h: number; s: number; l: number };

type Classification = { bucket: ColorBucket; hue?: number };

/**
 * Converts a 6-digit hex color (e.g. "#3b82f6") to its HSL components - the standard RGB->HSL
 * formula, no ShapeThing-specific convention involved. Returns undefined for anything that isn't a
 * valid 6-digit hex string.
 */
export function hexToHsl(hex: string): Hsl | undefined {
  if (!HEX_COLOR_PATTERN.test(hex)) return undefined;

  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  const saturation =
    delta === 0 ? 0 : lightness < 0.5 ? delta / (max + min) : delta / (2 - max - min);

  let hue: number;
  if (delta === 0) hue = 0;
  else if (max === r) hue = (60 * ((g - b) / delta) + 360) % 360;
  else if (max === g) hue = 60 * ((b - r) / delta) + 120;
  else hue = 60 * ((r - g) / delta) + 240;

  return { h: hue, s: saturation * 100, l: lightness * 100 };
}

/**
 * The standard reverse of hexToHsl - converts HSL components back to a 6-digit hex string, for
 * whichever UI edge still wants one (ColorEditor's native `<input type=color>`, a swatch's own
 * `background-color`). Not a lossless round trip for every possible input (an out-of-range h/s/l
 * clamps rather than throwing), but exact for anything hexToHsl itself produced.
 */
export function hslToHex({ h, s, l }: Hsl): string {
  const saturation = s / 100;
  const lightness = l / 100;

  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hPrime = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = lightness - c / 2;

  let [r, g, b] = [0, 0, 0];
  if (hPrime < 1) [r, g, b] = [c, x, 0];
  else if (hPrime < 2) [r, g, b] = [x, c, 0];
  else if (hPrime < 3) [r, g, b] = [0, c, x];
  else if (hPrime < 4) [r, g, b] = [0, x, c];
  else if (hPrime < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * The one place the bucket-threshold cascade lives, in JS form - sparqlFilterForBucket below is
 * this same cascade's SPARQL-text counterpart (kept in lock-step by hand, since they're two
 * separate representations - see that function's own doc comment). `hue` is only present for a
 * chromatic bucket (an achromatic one is classified by lightness/saturation before hue is even
 * considered).
 */
function classifyHsl({ h, s, l }: Hsl): Classification {
  if (l >= 94) return { bucket: "white" };
  if (l <= 8) return { bucket: "black" };
  if (s <= 15) return { bucket: "gray" };

  const hue = ((h % 360) + 360) % 360;
  if (hue < 15 || hue >= 345) return { bucket: "red", hue };
  if (hue < 45) return { bucket: "orange", hue };
  if (hue < 70) return { bucket: "yellow", hue };
  if (hue < 170) return { bucket: "green", hue };
  if (hue < 200) return { bucket: "cyan", hue };
  if (hue < 260) return { bucket: "blue", hue };
  if (hue < 290) return { bucket: "purple", hue };
  return { bucket: "pink", hue };
}

/**
 * Buckets an HSL color into one of a fixed set of named color buckets: near-white/near-black by
 * lightness, low-saturation by saturation, otherwise by hue range.
 *
 * The threshold constants below are a design choice, not derived from any spec - e.g. a fully
 * saturated hue-300 value buckets as "pink" here even though CSS's own named "purple" (#800080)
 * happens to sit at that same hue.
 */
export function bucketForHsl(hsl: Hsl): ColorBucket {
  return classifyHsl(hsl).bucket;
}

/**
 * Hex-string convenience wrapper around bucketForHsl, for the one remaining UI edge that still
 * speaks hex: ColorEditor's native `<input type=color>`. Returns undefined for anything that isn't
 * a valid 6-digit hex string, same as hexToHsl.
 */
export function bucketForHexColor(hex: string): ColorBucket | undefined {
  const hsl = hexToHsl(hex);
  return hsl ? bucketForHsl(hsl) : undefined;
}

/**
 * The SPARQL FILTER boolean expression (over ?hue/?sat/?light - degrees/percent, the same units
 * Hsl uses) for "this HSL color belongs to `bucket`" - classifyHsl's own cascade above, expressed
 * as SPARQL text instead of JS. structure/filterShape.ts's syncColorBucketSparqlConstraint splices
 * this into a real sh:sparql/SPARQLConstraint alongside st:ColorFacet's own plain st:colorBucket
 * value (the same "bespoke value for this renderer's own fast synchronous path, standards-form
 * SPARQL text for an external consumer" split syncWithinAreaSparqlConstraint already uses for
 * MapFacet's st:withinArea) - this renderer's own instanceSatisfiesConstraintNode never evaluates
 * this text itself, it calls classifyHsl (via bucketForHsl) directly.
 *
 * Must stay in lock-step with classifyHsl's own thresholds (94/8/15, the same hue cutoffs) by
 * hand - there's no shared code between the two representations, only shared threshold values.
 */
export function sparqlFilterForBucket(bucket: ColorBucket): string {
  const achromaticGuard = "?light < 94 && ?light > 8 && ?sat > 15";
  switch (bucket) {
    case "white":
      return "?light >= 94";
    case "black":
      return "?light <= 8";
    case "gray":
      return "?light < 94 && ?light > 8 && ?sat <= 15";
    case "red":
      return `${achromaticGuard} && (?hue < 15 || ?hue >= 345)`;
    case "orange":
      return `${achromaticGuard} && ?hue >= 15 && ?hue < 45`;
    case "yellow":
      return `${achromaticGuard} && ?hue >= 45 && ?hue < 70`;
    case "green":
      return `${achromaticGuard} && ?hue >= 70 && ?hue < 170`;
    case "cyan":
      return `${achromaticGuard} && ?hue >= 170 && ?hue < 200`;
    case "blue":
      return `${achromaticGuard} && ?hue >= 200 && ?hue < 260`;
    case "purple":
      return `${achromaticGuard} && ?hue >= 260 && ?hue < 290`;
    case "pink":
      return `${achromaticGuard} && ?hue >= 290 && ?hue < 345`;
  }
}
