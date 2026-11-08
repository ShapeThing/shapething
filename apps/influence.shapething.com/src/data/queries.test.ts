import { expect, test } from "vite-plus/test";
import { searchParameters } from "./queries.ts";

test("the full text search has the words, limited to humans", () => {
  const { search, fullText } = searchParameters("Søren  Kierke-gaard");
  expect(search.value).toBe("Søren  Kierke-gaard");
  expect(fullText.value).toBe("søren kierke gaard haswbstatement:P31=Q5");
});

test("every word starts a word of the name, in any order", () => {
  // Java regular expressions, but this one reads the same in JavaScript.
  const pattern = new RegExp(searchParameters("kierke sør").namePattern.value, "iu");
  expect(pattern.test("Søren Kierkegaard")).toBe(true);
  expect(pattern.test("Kierkegaard")).toBe(false);
  expect(pattern.test("Asøren Kierkegaard")).toBe(false);
});
