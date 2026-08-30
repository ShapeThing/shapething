import { expect, test } from "vite-plus/test";
import { termToJsValue } from "@/helpers/termToJsValue.ts";
import { factory } from "@/helpers/factory.ts";
import { rdf, xsd } from "@/helpers/namespaces.ts";

test("termToJsValue - returns string-like datatypes as-is", () => {
  expect(termToJsValue(factory.literal("hello", xsd("string")))).toEqual("hello");
  expect(termToJsValue(factory.literal("hello", rdf("langString")))).toEqual("hello");
  expect(termToJsValue(factory.literal("hello", xsd("anyURI")))).toEqual("hello");
});

test("termToJsValue - parses xsd:boolean", () => {
  expect(termToJsValue(factory.literal("true", xsd("boolean")))).toBe(true);
  expect(termToJsValue(factory.literal("false", xsd("boolean")))).toBe(false);
  expect(termToJsValue(factory.literal("1", xsd("boolean")))).toBe(true);
  expect(termToJsValue(factory.literal("0", xsd("boolean")))).toBe(false);
});

test("termToJsValue - parses numeric datatypes to number", () => {
  expect(termToJsValue(factory.literal("42", xsd("integer")))).toBe(42);
  expect(termToJsValue(factory.literal("3.14", xsd("decimal")))).toBe(3.14);
  expect(termToJsValue(factory.literal("2.5e3", xsd("double")))).toBe(2500);
});

test("termToJsValue - parses xsd:date and xsd:dateTime to Date", () => {
  expect(termToJsValue(factory.literal("2024-03-15", xsd("date")))).toEqual(
    new Date("2024-03-15"),
  );
  expect(termToJsValue(factory.literal("2024-03-15T10:30:00Z", xsd("dateTime")))).toEqual(
    new Date("2024-03-15T10:30:00Z"),
  );
});

test("termToJsValue - parses xsd:gYear to a UTC Date anchored at Jan 1st", () => {
  expect(termToJsValue(factory.literal("2024", xsd("gYear")))).toEqual(
    new Date(Date.UTC(2024, 0, 1)),
  );
});

test("termToJsValue - parses xsd:gYearMonth to a UTC Date anchored at day 1", () => {
  expect(termToJsValue(factory.literal("2024-03", xsd("gYearMonth")))).toEqual(
    new Date(Date.UTC(2024, 2, 1)),
  );
});

test("termToJsValue - parses xsd:gMonthDay to a UTC Date anchored at the 1970 epoch year", () => {
  expect(termToJsValue(factory.literal("--03-15", xsd("gMonthDay")))).toEqual(
    new Date(Date.UTC(1970, 2, 15)),
  );
});

test("termToJsValue - parses xsd:gDay to a UTC Date anchored at 1970-01", () => {
  expect(termToJsValue(factory.literal("---15", xsd("gDay")))).toEqual(
    new Date(Date.UTC(1970, 0, 15)),
  );
});

test("termToJsValue - falls back to the raw lexical string for an unrecognized datatype", () => {
  const custom = factory.namedNode("http://example.org/customType");
  expect(termToJsValue(factory.literal("whatever", custom))).toEqual("whatever");
});
