import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { xsd } from "@/helpers/namespaces.ts";
import { formatDuration } from "./formatDuration.ts";

const labels = {
  years: "Years",
  months: "Months",
  days: "Days",
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds",
  milliseconds: "Milliseconds",
};

test("formatDuration() renders every non-zero unit, including year/month components DurationEditor drops", () => {
  const term = factory.literal("P1Y2M10DT15H30M5S", xsd("duration"));
  expect(formatDuration(term, labels)).toBe(
    "1 Years 2 Months 10 Days 15 Hours 30 Minutes 5 Seconds",
  );
});

test("formatDuration() renders milliseconds from a fractional seconds component", () => {
  const term = factory.literal("PT5.5S", xsd("duration"));
  expect(formatDuration(term, labels)).toBe("5 Seconds 500 Milliseconds");
});

test("formatDuration() skips zero-valued units", () => {
  const term = factory.literal("P1D", xsd("duration"));
  expect(formatDuration(term, labels)).toBe("1 Days");
});

test("formatDuration() renders a zero duration as 0 seconds", () => {
  const term = factory.literal("PT0S", xsd("duration"));
  expect(formatDuration(term, labels)).toBe("0 Seconds");
});

test("formatDuration() prefixes a negative duration with a single leading minus sign", () => {
  const term = factory.literal("-P1DT2H", xsd("duration"));
  expect(formatDuration(term, labels)).toBe("-1 Days 2 Hours");
});

test("formatDuration() falls back to the raw literal value for an empty or unparsable value", () => {
  expect(formatDuration(factory.literal("", xsd("duration")), labels)).toBe("");
  expect(formatDuration(factory.literal("not a duration", xsd("duration")), labels)).toBe(
    "not a duration",
  );
});
