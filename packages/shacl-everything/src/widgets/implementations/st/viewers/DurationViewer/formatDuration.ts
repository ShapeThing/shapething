import { Temporal } from "@js-temporal/polyfill";
import type { Term } from "@rdfjs/types";

const UNITS = ["years", "months", "days", "hours", "minutes", "seconds", "milliseconds"] as const;
type Unit = (typeof UNITS)[number];

/**
 * Unlike DurationEditor (bound to react-duration-control's day/hour/minute/second/millisecond-only
 * units - see its own duration.ts), this viewer has no control library to satisfy, so it renders
 * every xsd:duration component Temporal.Duration understands, year/month included, rather than
 * dropping them.
 */
export function formatDuration(term: Term, labels: Record<Unit, string>): string {
  let duration: Temporal.Duration;
  try {
    duration = Temporal.Duration.from(term.value);
  } catch {
    return term.value;
  }

  const parts = UNITS.map((unit) => [unit, duration[unit]] as const).filter(
    ([, value]) => value !== 0,
  );
  if (parts.length === 0) return `0 ${labels.seconds}`;

  const sign = duration.sign < 0 ? "-" : "";
  return sign + parts.map(([unit, value]) => `${Math.abs(value)} ${labels[unit]}`).join(" ");
}
