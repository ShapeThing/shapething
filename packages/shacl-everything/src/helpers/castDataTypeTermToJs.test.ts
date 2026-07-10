import { expect, test } from "vite-plus/test";
import { castDataTypeTermToJs } from "@/helpers/castDataTypeTermToJs.ts";
import { rdf, xsd } from "@/helpers/namespaces.ts";
import { factory } from "@/helpers/factory.ts";

test("castDataTypeTermToJs - maps string-like datatypes to 'string'", () => {
  expect(castDataTypeTermToJs(xsd("string"))).toEqual("string");
  expect(castDataTypeTermToJs(xsd("normalizedString"))).toEqual("string");
  expect(castDataTypeTermToJs(xsd("anyURI"))).toEqual("string");
  expect(castDataTypeTermToJs(xsd("base64Binary"))).toEqual("string");
  expect(castDataTypeTermToJs(xsd("language"))).toEqual("string");
  expect(castDataTypeTermToJs(xsd("Name"))).toEqual("string");
  expect(castDataTypeTermToJs(xsd("NCName"))).toEqual("string");
  expect(castDataTypeTermToJs(xsd("NMTOKEN"))).toEqual("string");
  expect(castDataTypeTermToJs(xsd("token"))).toEqual("string");
  expect(castDataTypeTermToJs(xsd("hexBinary"))).toEqual("string");
  expect(castDataTypeTermToJs(rdf("langString"))).toEqual("string");
});

test("castDataTypeTermToJs - maps xsd:boolean to 'boolean'", () => {
  expect(castDataTypeTermToJs(xsd("boolean"))).toEqual("boolean");
});

test("castDataTypeTermToJs - maps numeric datatypes to 'number'", () => {
  expect(castDataTypeTermToJs(xsd("integer"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("long"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("int"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("byte"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("short"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("negativeInteger"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("nonNegativeInteger"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("nonPositiveInteger"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("positiveInteger"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("unsignedByte"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("unsignedInt"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("unsignedLong"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("unsignedShort"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("double"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("decimal"))).toEqual("number");
  expect(castDataTypeTermToJs(xsd("float"))).toEqual("number");
});

test("castDataTypeTermToJs - maps date/time datatypes to 'Date'", () => {
  expect(castDataTypeTermToJs(xsd("dateTime"))).toEqual("Date");
  expect(castDataTypeTermToJs(xsd("date"))).toEqual("Date");
  expect(castDataTypeTermToJs(xsd("gDay"))).toEqual("Date");
  expect(castDataTypeTermToJs(xsd("gMonthDay"))).toEqual("Date");
  expect(castDataTypeTermToJs(xsd("gYear"))).toEqual("Date");
  expect(castDataTypeTermToJs(xsd("gYearMonth"))).toEqual("Date");
});

test("castDataTypeTermToJs - falls back to 'string' for an unrecognized datatype", () => {
  expect(castDataTypeTermToJs(factory.namedNode("http://example.com/customType"))).toEqual(
    "string",
  );
});
