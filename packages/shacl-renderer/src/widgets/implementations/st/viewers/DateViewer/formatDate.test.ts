import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { xsd } from "@/helpers/namespaces.ts";
import { formatDate } from "./formatDate.ts";

const literal = (value: string, datatype: string) => factory.literal(value, xsd(datatype));

test("formatDate() writes an xsd:date in the locale", () => {
  expect(formatDate(literal("1855-11-11", "date"), "en-GB")).toBe("11 November 1855");
  expect(formatDate(literal("1855-11-11", "date"), "nl-NL")).toBe("11 november 1855");
});

test("formatDate() shows an xsd:dateTime at midnight as a date, as Wikidata stores its dates", () => {
  expect(formatDate(literal("1855-11-11T00:00:00Z", "dateTime"), "en-GB")).toBe("11 November 1855");
});

test("formatDate() shows the time of an xsd:dateTime as written, without converting its offset", () => {
  expect(formatDate(literal("2024-05-01T09:30:00+02:00", "dateTime"), "en-GB")).toBe(
    "1 May 2024 at 09:30",
  );
  expect(formatDate(literal("2024-05-01T09:30:15", "dateTimeStamp"), "en-GB")).toBe(
    "1 May 2024 at 09:30:15",
  );
});

test("formatDate() shows only the parts an xsd:gYear or xsd:gYearMonth has", () => {
  expect(formatDate(literal("1855", "gYear"), "en-GB")).toBe("1855");
  expect(formatDate(literal("1855-11", "gYearMonth"), "en-GB")).toBe("November 1855");
});

test("formatDate() writes years before the common era with an era, year 0 being 1 BC", () => {
  expect(formatDate(literal("-0383", "gYear"), "en-GB")).toBe("384 BC");
  expect(formatDate(literal("0000", "gYear"), "en-GB")).toBe("1 BC");
  expect(formatDate(literal("0042-03-15", "date"), "en-GB")).toBe("15 March 42");
});

test("formatDate() returns anything it cannot read as written", () => {
  expect(formatDate(literal("not a date", "date"), "en-GB")).toBe("not a date");
  expect(formatDate(factory.literal("1855-11-11"), "en-GB")).toBe("1855-11-11");
  expect(formatDate(factory.namedNode("http://example.org/date"), "en-GB")).toBe(
    "http://example.org/date",
  );
});

test("formatDate() falls back to English for a locale that is not a BCP 47 tag", () => {
  expect(formatDate(literal("1855-11-11", "date"), "*")).toBe("November 11, 1855");
});
