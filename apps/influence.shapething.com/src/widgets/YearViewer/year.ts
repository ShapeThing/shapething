import type { Term } from "@rdfjs/types";

const XSD = "http://www.w3.org/2001/XMLSchema#";
const DATE_DATATYPES = new Set(
  ["dateTime", "dateTimeStamp", "date", "gYear", "gYearMonth"].map((local) => XSD + local),
);

/**
 * The year of an xsd date literal, as written (astronomical numbering: year 0 is 1 BCE), or
 * undefined for anything else.
 */
export const yearOf = (term: Term): number | undefined => {
  if (term.termType !== "Literal" || !DATE_DATATYPES.has(term.datatype.value)) return undefined;
  const match = /^(-?)(\d{4,})/.exec(term.value);
  if (!match) return undefined;
  const year = Number.parseInt(match[2], 10);
  return match[1] === "-" ? -year : year;
};

/**
 * A year as it is written in English: 1813, or 384 BCE.
 *
 * Wikidata writes dates in RDF the way XSD 1.1 does, where year 0 is 1 BCE: Aristotle, born in 384
 * BCE, has "-0383-01-01T00:00:00Z". So a year of 0 or before is 1 - year BCE. (Wikidata only does
 * this for dates known to the year or better, a date known to the decade or century keeps the BCE
 * year it was entered with. The precision is not in the simple wdt: triples, so those dates show one
 * year early.)
 */
export const formatYear = (year: number): string => (year > 0 ? String(year) : `${1 - year} BCE`);
