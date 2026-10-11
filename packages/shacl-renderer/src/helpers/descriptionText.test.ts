import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { rdf, xsd } from "@/helpers/namespaces.ts";
import { descriptionText } from "@/helpers/descriptionText.ts";

test("descriptionText flattens an rdf:HTML literal to its text", () => {
  const literal = factory.literal("<p>A <b>volcanic</b>\n island.</p>", rdf("HTML"));
  expect(descriptionText(literal)).toBe("A volcanic island.");
});

test("descriptionText leaves a plain string literal untouched", () => {
  const literal = factory.literal("1 < 2 <b>not markup</b>", xsd("string"));
  expect(descriptionText(literal)).toBe("1 < 2 <b>not markup</b>");
});
