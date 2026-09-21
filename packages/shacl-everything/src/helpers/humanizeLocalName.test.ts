import { expect, test } from "vite-plus/test";
import { humanizeLocalName } from "@/helpers/humanizeLocalName.ts";

test("humanizeLocalName - splits a camelCase name into words", () => {
  expect(humanizeLocalName("givenName")).toEqual("given Name");
});

test("humanizeLocalName - keeps an acronym run together as one word", () => {
  expect(humanizeLocalName("XMLParser")).toEqual("XML Parser");
});

test("humanizeLocalName - splits a trailing acronym from the word before it", () => {
  expect(humanizeLocalName("someURL")).toEqual("some URL");
});

test("humanizeLocalName - splits letters and digits in either direction", () => {
  expect(humanizeLocalName("postalCode2")).toEqual("postal Code 2");
  expect(humanizeLocalName("3dModel")).toEqual("3 d Model");
});

test("humanizeLocalName - handles a mix of camelCase, acronym, and digit boundaries", () => {
  expect(humanizeLocalName("hasXMLParser2")).toEqual("has XML Parser 2");
});

test("humanizeLocalName - leaves a single lowercase word unchanged", () => {
  expect(humanizeLocalName("name")).toEqual("name");
});

test("humanizeLocalName - leaves a single capitalized word unchanged", () => {
  expect(humanizeLocalName("Person")).toEqual("Person");
});

test("humanizeLocalName - returns an empty string unchanged", () => {
  expect(humanizeLocalName("")).toEqual("");
});
