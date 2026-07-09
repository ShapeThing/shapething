import type { Term } from "@rdfjs/types";
import { rdf, xsd } from "./namespaces.ts";

// Translated from https://github.com/rubensworks/rdf-literal.js
export const castDataTypeTermToJs = (datatype: Term) => {
  // String types
  if (datatype.equals(xsd("string"))) return "string";
  if (datatype.equals(xsd("normalizedString"))) return "string";
  if (datatype.equals(xsd("anyURI"))) return "string";
  if (datatype.equals(xsd("base64Binary"))) return "string";
  if (datatype.equals(xsd("language"))) return "string";
  if (datatype.equals(xsd("Name"))) return "string";
  if (datatype.equals(xsd("NCName"))) return "string";
  if (datatype.equals(xsd("NMTOKEN"))) return "string";
  if (datatype.equals(xsd("token"))) return "string";
  if (datatype.equals(xsd("hexBinary"))) return "string";
  if (datatype.equals(rdf("langString"))) return "string";

  // Boolean type
  if (datatype.equals(xsd("boolean"))) return "boolean";

  // Number types
  if (datatype.equals(xsd("integer"))) return "number";
  if (datatype.equals(xsd("long"))) return "number";
  if (datatype.equals(xsd("int"))) return "number";
  if (datatype.equals(xsd("byte"))) return "number";
  if (datatype.equals(xsd("short"))) return "number";
  if (datatype.equals(xsd("negativeInteger"))) return "number";
  if (datatype.equals(xsd("nonNegativeInteger"))) return "number";
  if (datatype.equals(xsd("nonPositiveInteger"))) return "number";
  if (datatype.equals(xsd("positiveInteger"))) return "number";
  if (datatype.equals(xsd("unsignedByte"))) return "number";
  if (datatype.equals(xsd("unsignedInt"))) return "number";
  if (datatype.equals(xsd("unsignedLong"))) return "number";
  if (datatype.equals(xsd("unsignedShort"))) return "number";
  if (datatype.equals(xsd("double"))) return "number";
  if (datatype.equals(xsd("decimal"))) return "number";
  if (datatype.equals(xsd("float"))) return "number";

  // Date types
  if (datatype.equals(xsd("dateTime"))) return "Date";
  if (datatype.equals(xsd("date"))) return "Date";
  if (datatype.equals(xsd("gDay"))) return "Date";
  if (datatype.equals(xsd("gMonthDay"))) return "Date";
  if (datatype.equals(xsd("gYear"))) return "Date";
  if (datatype.equals(xsd("gYearMonth"))) return "Date";

  return "string";
};
