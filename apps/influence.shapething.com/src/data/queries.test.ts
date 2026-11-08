import { expect, test } from "vite-plus/test";
import { searchParameters } from "./queries.ts";
import { DEFAULT_SEARCH_CLASS, SEARCH_CLASSES } from "./searchClasses.ts";

const bands = SEARCH_CLASSES.find((searchClass) => searchClass.label === "Bands")!;
const programmingLanguages = SEARCH_CLASSES.find((searchClass) => searchClass.id === "Q9143")!;

test("the full text search has the words, limited to the direct values of the class", () => {
  const {
    search,
    fullText,
    class: philosophers,
    membership,
  } = searchParameters("Søren  Kierke-gaard", DEFAULT_SEARCH_CLASS);
  expect(search.value).toBe("Søren  Kierke-gaard");
  expect(fullText.value).toBe("søren kierke gaard haswbstatement:P106=Q4964182");
  expect(philosophers.value).toBe("http://www.wikidata.org/entity/Q4964182");
  expect(membership.value).toBe("http://www.wikidata.org/prop/direct/P106");
  expect(searchParameters("beatles", bands).fullText.value).toBe(
    "beatles haswbstatement:P31=Q215380|P31=Q5741069|P31=Q25391823|P31=Q9212979",
  );
  expect(searchParameters("beatles", bands).membership.value).toBe(
    "http://www.wikidata.org/prop/direct/P31",
  );
});

test("a class of mostly subclass instances has the words alone, the query keeps the class", () => {
  const { fullText, class: languages } = searchParameters("Lisp", programmingLanguages);
  expect(fullText.value).toBe("lisp");
  expect(languages.value).toBe("http://www.wikidata.org/entity/Q9143");
});

test("every word starts a word of the name, in any order", () => {
  // Java regular expressions, but this one reads the same in JavaScript.
  const pattern = new RegExp(
    searchParameters("kierke sør", DEFAULT_SEARCH_CLASS).namePattern.value,
    "iu",
  );
  expect(pattern.test("Søren Kierkegaard")).toBe(true);
  expect(pattern.test("Kierkegaard")).toBe(false);
  expect(pattern.test("Asøren Kierkegaard")).toBe(false);
});
