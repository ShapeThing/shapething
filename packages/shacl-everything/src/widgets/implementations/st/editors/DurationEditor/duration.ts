import { Temporal } from "@js-temporal/polyfill";
import type { Literal, Term } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { xsd } from "@/helpers/namespaces.ts";

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1_000;

/**
 * react-duration-control only understands day/hour/minute/second/millisecond units (see its own
 * DurationUnitType) - it has no notion of the calendar-relative year/month xsd:duration also
 * permits, since those have no fixed length without a reference date. A year/month component on
 * the source literal is therefore dropped here, same as it would be the moment the user edits and
 * blurs any unit (termFromMilliseconds below never reintroduces one).
 */
export function millisecondsFromTerm(term: Term): number {
  try {
    const duration = Temporal.Duration.from(term.value);
    return (
      duration.days * MS_PER_DAY +
      duration.hours * MS_PER_HOUR +
      duration.minutes * MS_PER_MINUTE +
      duration.seconds * MS_PER_SECOND +
      duration.milliseconds
    );
  } catch {
    return 0;
  }
}

export function termFromMilliseconds(milliseconds: number): Literal {
  const duration = Temporal.Duration.from({ milliseconds });
  return factory.literal(duration.toString(), xsd("duration"));
}
