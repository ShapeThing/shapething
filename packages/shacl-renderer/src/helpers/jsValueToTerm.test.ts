import { expect, test } from "vite-plus/test";
import type { NamedNode } from "@rdfjs/types";
import { jsValueToTerm } from "@/helpers/jsValueToTerm.ts";
import { factory } from "@/helpers/factory.ts";
import { rdf, xsd } from "@/helpers/namespaces.ts";

test("jsValueToTerm - writes a string as a plain literal of the given datatype", () => {
  expect(jsValueToTerm("hello", xsd("string"))).toEqual(factory.literal("hello", xsd("string")));
});

test("jsValueToTerm - writes a number and boolean via String()", () => {
  expect(jsValueToTerm(42, xsd("integer"))).toEqual(factory.literal("42", xsd("integer")));
  expect(jsValueToTerm(true, xsd("boolean"))).toEqual(factory.literal("true", xsd("boolean")));
});

test("jsValueToTerm - writes rdf:langString with the given language tag, not as a datatype", () => {
  const term = jsValueToTerm("hello", rdf("langString"), "en");
  expect(term.value).toEqual("hello");
  expect(term.language).toEqual("en");
  expect(term.datatype.equals(rdf("langString"))).toBe(true);
});

test("jsValueToTerm - defaults rdf:langString to no language tag when none is given", () => {
  const term = jsValueToTerm("hello", rdf("langString"));
  expect(term.language).toEqual("");
});

test("jsValueToTerm - formats xsd:date as YYYY-MM-DD", () => {
  const term = jsValueToTerm(new Date(Date.UTC(2024, 2, 15)), xsd("date"));
  expect(term.value).toEqual("2024-03-15");
});

test("jsValueToTerm - formats xsd:dateTime as a full ISO string", () => {
  const term = jsValueToTerm(new Date("2024-03-15T10:30:00Z"), xsd("dateTime"));
  expect(term.value).toEqual("2024-03-15T10:30:00.000Z");
});

test("jsValueToTerm - formats xsd:gYear/gYearMonth/gMonthDay/gDay from their UTC anchors", () => {
  expect(jsValueToTerm(new Date(Date.UTC(2024, 0, 1)), xsd("gYear")).value).toEqual("2024");
  expect(jsValueToTerm(new Date(Date.UTC(2024, 2, 1)), xsd("gYearMonth")).value).toEqual("2024-03");
  expect(jsValueToTerm(new Date(Date.UTC(1970, 2, 15)), xsd("gMonthDay")).value).toEqual("--03-15");
  expect(jsValueToTerm(new Date(Date.UTC(1970, 0, 15)), xsd("gDay")).value).toEqual("---15");
});

test("jsValueToTerm - round-trips a literal's lexical form through termToJsValue and back", async () => {
  const { termToJsValue } = await import("@/helpers/termToJsValue.ts");
  const cases: [string, NamedNode][] = [
    ["2024-03-15", xsd("date")],
    ["2024-03-15T10:30:00.000Z", xsd("dateTime")],
    ["2024", xsd("gYear")],
    ["2024-03", xsd("gYearMonth")],
    ["--03-15", xsd("gMonthDay")],
    ["---15", xsd("gDay")],
  ];

  for (const [lexicalForm, datatype] of cases) {
    const value = termToJsValue(factory.literal(lexicalForm, datatype)) as Date;
    const roundTripped = jsValueToTerm(value, datatype);
    expect(roundTripped.value).toEqual(lexicalForm);
  }
});
