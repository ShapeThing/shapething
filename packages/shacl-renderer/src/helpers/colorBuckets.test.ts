import { expect, test } from "vite-plus/test";
import {
  bucketForHexColor,
  bucketForHsl,
  hexToHsl,
  hslToHex,
  sparqlFilterForBucket,
  COLOR_BUCKET_ORDER,
} from "./colorBuckets.ts";

test("buckets primary/secondary hues correctly", () => {
  expect(bucketForHexColor("#ff0000")).toBe("red");
  expect(bucketForHexColor("#ffa500")).toBe("orange");
  expect(bucketForHexColor("#ffff00")).toBe("yellow");
  expect(bucketForHexColor("#00ff00")).toBe("green");
  expect(bucketForHexColor("#00ffff")).toBe("cyan");
  expect(bucketForHexColor("#0000ff")).toBe("blue");
  expect(bucketForHexColor("#ff00ff")).toBe("pink");
});

test("buckets achromatic values by lightness/saturation, not hue", () => {
  expect(bucketForHexColor("#ffffff")).toBe("white");
  expect(bucketForHexColor("#fefefe")).toBe("white");
  expect(bucketForHexColor("#000000")).toBe("black");
  expect(bucketForHexColor("#101010")).toBe("black");
  expect(bucketForHexColor("#808080")).toBe("gray");
  expect(bucketForHexColor("#c0c0c0")).toBe("gray");
});

test("rejects anything that isn't a plain 6-digit hex string", () => {
  expect(bucketForHexColor("#fff")).toBeUndefined();
  expect(bucketForHexColor("red")).toBeUndefined();
  expect(bucketForHexColor("rgb(255, 0, 0)")).toBeUndefined();
  expect(bucketForHexColor("#gggggg")).toBeUndefined();
});

test("accepts uppercase hex digits the same as lowercase", () => {
  expect(bucketForHexColor("#FF0000")).toBe("red");
  expect(bucketForHexColor("#00FF00")).toBe("green");
});

test("hue exactly at a boundary lands on the higher bucket, not the lower one", () => {
  // #ff4000 -> hue ~= 15.06, close enough to orange's own lower boundary (15) to exercise it
  // without floating-point flakiness landing on the wrong side.
  expect(bucketForHexColor("#ff4000")).toBe("orange");
});

test("a hue past the 345 cutoff wraps around to red", () => {
  // #ff002b -> hue ~= 349.9, on red's side of the 345/15 seam.
  expect(bucketForHexColor("#ff002b")).toBe("red");
});

test("hexToHsl: known hex values convert to their expected HSL components", () => {
  expect(hexToHsl("#ff0000")).toEqual({ h: 0, s: 100, l: 50 });
  expect(hexToHsl("#00ff00")).toEqual({ h: 120, s: 100, l: 50 });
  expect(hexToHsl("#0000ff")).toEqual({ h: 240, s: 100, l: 50 });
  expect(hexToHsl("#ffffff")).toEqual({ h: 0, s: 0, l: 100 });
  expect(hexToHsl("#000000")).toEqual({ h: 0, s: 0, l: 0 });
  expect(hexToHsl("#808080")).toEqual({ h: 0, s: 0, l: expect.closeTo(50.2, 1) });
});

test("hexToHsl: rejects anything that isn't a plain 6-digit hex string", () => {
  expect(hexToHsl("#fff")).toBeUndefined();
  expect(hexToHsl("red")).toBeUndefined();
});

test("hslToHex round-trips hexToHsl for a range of colors", () => {
  for (const hex of ["#ff0000", "#2563eb", "#22c55e", "#a855f7", "#6b7280", "#f8fafc", "#0a0a0a"]) {
    const hsl = hexToHsl(hex)!;
    expect(hslToHex(hsl)).toBe(hex);
  }
});

// bucketForHsl is the HSL-native entry point (no hex round trip) - it must agree with
// bucketForHexColor for the exact same color.
test("bucketForHsl agrees with bucketForHexColor for the same color", () => {
  const samples = [
    "#ff0000",
    "#ff8000",
    "#ffff00",
    "#00ff00",
    "#00ffff",
    "#0000ff",
    "#8000ff",
    "#ff00ff",
    "#ffffff",
    "#808080",
    "#000000",
  ];
  for (const hex of samples) {
    const hsl = hexToHsl(hex)!;
    expect(bucketForHsl(hsl)).toBe(bucketForHexColor(hex));
  }
});

// sparqlFilterForBucket is classifyHsl's cascade expressed as SPARQL text instead of JS - each
// case builds a tiny in-memory "evaluator" from the generated FILTER text (substituting ?hue/
// ?sat/?light with the sample's own values and running it as a JS expression) and checks it agrees
// with bucketForHsl on both a member and every non-member sample, for every bucket.
function evaluateSparqlFilter(filter: string, hsl: { h: number; s: number; l: number }): boolean {
  const jsExpression = filter
    .replace(/&&/g, "&&")
    .replace(/\?hue/g, String(hsl.h))
    .replace(/\?sat/g, String(hsl.s))
    .replace(/\?light/g, String(hsl.l));
  // eslint-disable-next-line no-new-func
  return new Function(`return (${jsExpression});`)() as boolean;
}

test("sparqlFilterForBucket agrees with bucketForHsl for every bucket, on every sample", () => {
  const samples: Record<string, { h: number; s: number; l: number }> = {
    red: { h: 0, s: 100, l: 50 },
    orange: { h: 30, s: 100, l: 50 },
    yellow: { h: 60, s: 100, l: 50 },
    green: { h: 120, s: 100, l: 50 },
    cyan: { h: 180, s: 100, l: 50 },
    blue: { h: 240, s: 100, l: 50 },
    purple: { h: 270, s: 100, l: 50 },
    pink: { h: 300, s: 100, l: 50 },
    white: { h: 0, s: 0, l: 100 },
    gray: { h: 0, s: 0, l: 50 },
    black: { h: 0, s: 0, l: 0 },
  };

  for (const bucket of COLOR_BUCKET_ORDER) {
    const filter = sparqlFilterForBucket(bucket);
    for (const [sampleBucket, hsl] of Object.entries(samples)) {
      const expected = bucketForHsl(hsl) === bucket;
      expect(evaluateSparqlFilter(filter, hsl)).toBe(expected);
      if (sampleBucket === bucket) expect(expected).toBe(true);
    }
  }
});

test("sparqlFilterForBucket: red's own wraparound condition matches a hue just past 345 and just under 15", () => {
  const filter = sparqlFilterForBucket("red");
  expect(evaluateSparqlFilter(filter, { h: 350, s: 100, l: 50 })).toBe(true);
  expect(evaluateSparqlFilter(filter, { h: 10, s: 100, l: 50 })).toBe(true);
  expect(evaluateSparqlFilter(filter, { h: 200, s: 100, l: 50 })).toBe(false);
});
