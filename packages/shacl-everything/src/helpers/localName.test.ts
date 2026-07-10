import { expect, test } from "vite-plus/test";
import { localName } from "@/helpers/localName.ts";
import { factory } from "@/helpers/factory.ts";

test("localName - returns null when given no term", () => {
  expect(localName(undefined)).toBeNull();
});

test("localName - returns null for a blank node", () => {
  expect(localName(factory.blankNode("b0"))).toBeNull();
});

test("localName - takes the part after the last hash", () => {
  expect(localName(factory.namedNode("http://example.com/ontology#Person"))).toEqual("Person");
});

test("localName - takes the part after the last slash when there is no hash", () => {
  expect(localName(factory.namedNode("http://example.com/Person"))).toEqual("Person");
});

test("localName - prefers the hash over a slash that precedes it", () => {
  expect(localName(factory.namedNode("http://example.com/path/to#Person"))).toEqual("Person");
});

test("localName - uses the last hash when there is more than one", () => {
  expect(localName(factory.namedNode("http://example.com/a#b#Person"))).toEqual("Person");
});

test("localName - uses the last slash when there is no hash", () => {
  expect(localName(factory.namedNode("http://example.com/a/b/Person"))).toEqual("Person");
});

test("localName - returns the whole value when there is neither a hash nor a slash", () => {
  expect(localName(factory.namedNode("Person"))).toEqual("Person");
});

test("localName - returns an empty string for a trailing slash", () => {
  expect(localName(factory.namedNode("http://example.com/"))).toEqual("");
});

test("localName - works on a literal's value too", () => {
  expect(localName(factory.literal("http://example.com/Person"))).toEqual("Person");
});
