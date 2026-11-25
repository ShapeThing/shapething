import { expect, test } from "vitest";
import { stringToGradient as reference } from "string-to-color-gradient";
import { stringToGradient } from "@/helpers/stringToGradient.ts";

const samples = [
  "",
  "Person",
  "Organisatie",
  "a",
  "Ünïcödé — 名前 🙂",
  "x".repeat(55),
  "x".repeat(56),
  "x".repeat(64),
  "x".repeat(200),
  ...Array.from({ length: 500 }, (_, i) => `label ${i} ${String.fromCharCode(65 + (i % 50))}`),
];

test("matches string-to-color-gradient's light gradient exactly", () => {
  for (const sample of samples) {
    expect(stringToGradient(sample), sample).toEqual(reference(sample, { brightness: "light" }));
  }
});
