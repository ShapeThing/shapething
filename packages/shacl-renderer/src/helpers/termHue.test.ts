import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { termHue, termHueStyle } from "@/helpers/termHue.ts";

const idea = factory.namedNode("http://www.wikidata.org/entity/Q1033");

test("a term has a hue of its own, the same every time", () => {
  const hue = termHue(idea);
  expect(Number.isInteger(hue)).toBe(true);
  expect(hue).toBeGreaterThanOrEqual(0);
  expect(hue).toBeLessThan(360);
  expect(termHue(factory.namedNode(idea.value))).toBe(hue);
});

test("an IRI and a literal with the same text have their own hue", () => {
  const hues = new Set(
    ["Q1033", "Q5891", "Q9465", "Q42", "Q868"].map((id) =>
      termHue(factory.namedNode(`http://www.wikidata.org/entity/${id}`)),
    ),
  );
  expect(hues.size).toBeGreaterThan(1);
  expect(termHue(factory.literal(idea.value))).not.toBe(termHue(idea));
});

test("the hue is set as --st-term-hue", () => {
  expect(termHueStyle(idea)).toEqual({ "--st-term-hue": termHue(idea) });
});
