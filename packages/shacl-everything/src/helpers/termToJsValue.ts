import type { Literal, NamedNode } from "@rdfjs/types";
import { castDataTypeTermToJs } from "@/helpers/castDataTypeTermToJs.ts";
import { xsd } from "@/helpers/namespaces.ts";

/**
 * Coerces a literal's lexical form to a native JS value, using castDataTypeTermToJs to classify
 * the datatype and only branching further to pick apart the five distinct xsd date/time shapes
 * ("Date") - gYear/gYearMonth/gMonthDay/gDay have no native JS type of their own, so each is
 * anchored at UTC 1970-01-01 in whichever component(s) it doesn't carry (see jsValueToTerm.ts,
 * its write-side counterpart, for how the same anchoring is undone on the way back out).
 */
export function termToJsValue(literal: Literal): string | boolean | number | Date {
  const jsType = castDataTypeTermToJs(literal.datatype);

  if (jsType === "boolean") return literal.value === "true" || literal.value === "1";
  if (jsType === "number") return Number(literal.value);
  if (jsType === "Date") return parseDate(literal.value, literal.datatype);
  return literal.value;
}

function parseDate(value: string, datatype: NamedNode): Date {
  if (datatype.equals(xsd("gYear"))) return new Date(Date.UTC(Number(value), 0, 1));

  if (datatype.equals(xsd("gYearMonth"))) {
    const [year, month] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
  }

  if (datatype.equals(xsd("gMonthDay"))) {
    const [month, day] = value.slice(2).split("-").map(Number);
    return new Date(Date.UTC(1970, month - 1, day));
  }

  if (datatype.equals(xsd("gDay"))) {
    return new Date(Date.UTC(1970, 0, Number(value.slice(3))));
  }

  // xsd:date and xsd:dateTime are both valid ISO 8601 forms already - native parsing handles them.
  return new Date(value);
}
