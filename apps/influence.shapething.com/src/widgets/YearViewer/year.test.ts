import { DataFactory } from "rdf-data-factory";
import { expect, test } from "vite-plus/test";
import { formatYear, yearOf } from "./year.ts";

const factory = new DataFactory();
const XSD = "http://www.w3.org/2001/XMLSchema#";
const date = (value: string, type = "dateTime") =>
  factory.literal(value, factory.namedNode(XSD + type));

test("the year of a date", () => {
  expect(yearOf(date("1813-05-05T00:00:00Z"))).toBe(1813);
  expect(yearOf(date("1813", "gYear"))).toBe(1813);
});

test("a negative year as written (year 0 is 1 BCE)", () => {
  expect(yearOf(date("-0383-01-01T00:00:00Z"))).toBe(-383);
});

test("no year for what is not a date", () => {
  expect(yearOf(factory.literal("1813"))).toBeUndefined();
  expect(yearOf(factory.namedNode("http://example.com/1813"))).toBeUndefined();
  expect(yearOf(date("unknown"))).toBeUndefined();
});

test("years before the common era are written with BCE", () => {
  expect(formatYear(1813)).toBe("1813");
  expect(formatYear(-383)).toBe("384 BCE");
  expect(formatYear(0)).toBe("1 BCE");
});
