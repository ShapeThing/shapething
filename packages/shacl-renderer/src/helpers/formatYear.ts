import type { Term } from "@rdfjs/types";
import { xsd } from "@/helpers/namespaces.ts";

const DATE_DATATYPES = new Set(
  ["dateTime", "dateTimeStamp", "date", "gYear", "gYearMonth"].map((local) => xsd(local).value),
);

/**
 * The year of an xsd date literal (xsd:dateTime, xsd:dateTimeStamp, xsd:date, xsd:gYear,
 * xsd:gYearMonth), as written - astronomical numbering, where year 0 is 1 BCE - or undefined for
 * anything else.
 */
export function yearOf(term: Term): number | undefined {
  if (term.termType !== "Literal" || !DATE_DATATYPES.has(term.datatype.value)) return undefined;
  const match = /^(-?)(\d{4,})/.exec(term.value);
  if (!match) return undefined;
  const year = Number.parseInt(match[2], 10);
  return match[1] === "-" ? -year : year;
}

/**
 * A year as it is written in English: 1813, or 384 BCE. XSD 1.1 (and Wikidata's RDF) number years
 * astronomically, year 0 being 1 BCE, so a year of 0 or before is `1 - year` BCE.
 */
export function formatYear(year: number): string {
  return year > 0 ? String(year) : `${1 - year} BCE`;
}
