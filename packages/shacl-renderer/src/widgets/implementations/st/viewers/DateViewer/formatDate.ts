import type { Term } from "@rdfjs/types";
import { xsd } from "@/helpers/namespaces.ts";

const TIME_ZONE = "(?:Z|[+-]\\d{2}:\\d{2})?";
const YEAR = "(-?\\d{4,})";

// Each date datatype with its lexical form. A value only ever shows the parts its datatype has: an
// xsd:gYear is a year, an xsd:gYearMonth a month and a year.
const PATTERNS: Record<string, RegExp> = {
  [xsd("gYear").value]: new RegExp(`^${YEAR}${TIME_ZONE}$`),
  [xsd("gYearMonth").value]: new RegExp(`^${YEAR}-(\\d{2})${TIME_ZONE}$`),
  [xsd("date").value]: new RegExp(`^${YEAR}-(\\d{2})-(\\d{2})${TIME_ZONE}$`),
  [xsd("dateTime").value]: new RegExp(
    `^${YEAR}-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d+)?${TIME_ZONE}$`,
  ),
  [xsd("dateTimeStamp").value]: new RegExp(
    `^${YEAR}-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d+)?${TIME_ZONE}$`,
  ),
};

/**
 * An xsd date literal (xsd:date, xsd:dateTime, xsd:dateTimeStamp, xsd:gYear, xsd:gYearMonth) as
 * `locale` writes it: "11 November 1855", "November 1855", "1855", "384 BC".
 *
 * - The time of an xsd:dateTime is only shown when it is not midnight: a date stored as a dateTime
 *   (as Wikidata does, "1855-11-11T00:00:00Z") reads as a date.
 * - The time is the wall-clock time as written, its offset left out, so "09:30:00+02:00" shows as
 *   09:30 wherever the page is viewed.
 * - Years are numbered astronomically, as XSD 1.1 does: year 0 is 1 BC, -383 is 384 BC.
 *
 * Anything else, or a value that does not parse, is returned as written.
 */
export function formatDate(term: Term, locale: string): string {
  if (term.termType !== "Literal") return term.value;
  const match = PATTERNS[term.datatype.value]?.exec(term.value);
  if (!match) return term.value;

  const [year, month = 1, day = 1, hour = 0, minute = 0, second = 0] = match
    .slice(1)
    .filter((part) => part !== undefined)
    .map(Number);
  const hasMonth = match[2] !== undefined;
  const hasDay = match[3] !== undefined;
  const hasTime = hour !== 0 || minute !== 0 || second !== 0;

  // setUTCFullYear, unlike Date.UTC, takes years 0-99 as they are rather than as 1900-1999.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second);
  if (Number.isNaN(date.getTime())) return term.value;

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "UTC",
    year: "numeric",
    month: hasMonth ? "long" : undefined,
    day: hasDay ? "numeric" : undefined,
    hour: hasTime ? "2-digit" : undefined,
    minute: hasTime ? "2-digit" : undefined,
    second: hasTime && second !== 0 ? "2-digit" : undefined,
    era: year < 1 ? "short" : undefined,
  };
  return dateTimeFormat(locale, options).format(date);
}

function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale || "en", options);
  } catch {
    // Not a valid BCP 47 tag (e.g. "*" from a language preference).
    return new Intl.DateTimeFormat("en", options);
  }
}
