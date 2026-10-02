// shui:timeZone (3.4) support for xsd:dateTime: <input type="datetime-local"> deals in wall-clock
// time without an offset, so a configured IANA zone is what turns that into a full xsd:dateTime
// (on write) and an existing timezoned value back into that zone's wall-clock time (on read).

const OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;
const LOCAL_PATTERN = /^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?$/;

// The zone's UTC offset at `instant`, in minutes (e.g. 120 for Europe/Amsterdam in summer).
function offsetMinutes(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wallClock = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((wallClock - Math.floor(instant / 1000) * 1000) / 60000);
}

function formatOffset(minutes: number): string {
  if (minutes === 0) return "Z";
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/**
 * Appends `timeZone`'s offset at that wall-clock moment to an offset-less xsd:dateTime lexical
 * value ("2024-05-01T09:30:00" -> "2024-05-01T09:30:00+02:00"). A value that already carries an
 * offset, or doesn't parse, is returned unchanged.
 */
export function withTimeZone(value: string, timeZone: string): string {
  const match = LOCAL_PATTERN.exec(value);
  if (!match || OFFSET_PATTERN.test(value)) return value;
  const [, year, month, day, hour, minute, second = "0"] = match;
  const asUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  // The offset depends on the instant, which depends on the offset: one refinement settles it
  // (except for wall-clock times skipped or repeated by a DST switch, which have no single answer).
  const guess = offsetMinutes(asUtc, timeZone);
  const offset = offsetMinutes(asUtc - guess * 60000, timeZone);
  return `${value}${formatOffset(offset)}`;
}

/**
 * The wall-clock time in `timeZone` of a timezoned xsd:dateTime lexical value, without an offset -
 * what <input type="datetime-local"> can display ("2024-05-01T07:30:00Z" -> "2024-05-01T09:30:00"
 * for Europe/Amsterdam). A value without an offset, or that doesn't parse, is returned unchanged.
 */
export function inTimeZone(value: string, timeZone: string): string {
  if (!OFFSET_PATTERN.test(value)) return value;
  const instant = Date.parse(value);
  if (Number.isNaN(instant)) return value;
  const local = new Date(instant + offsetMinutes(instant, timeZone) * 60000);
  return local.toISOString().slice(0, 19);
}
