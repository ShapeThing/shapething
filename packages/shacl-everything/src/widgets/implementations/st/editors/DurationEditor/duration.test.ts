import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { xsd } from "@/helpers/namespaces.ts";
import { millisecondsFromTerm, termFromMilliseconds } from "./duration.ts";

test("millisecondsFromTerm() reads a plain day/hour/minute/second/millisecond xsd:duration", () => {
  const term = factory.literal("P1DT2H30M5.500S", xsd("duration"));
  const oneDay = 86_400_000;
  const twoHours = 2 * 3_600_000;
  const thirtyMinutes = 30 * 60_000;
  expect(millisecondsFromTerm(term)).toBe(oneDay + twoHours + thirtyMinutes + 5_500);
});

test("millisecondsFromTerm() drops year/month components, which react-duration-control has no unit for", () => {
  const term = factory.literal("P1Y2M10DT15H30M5S", xsd("duration"));
  const tenDays = 10 * 86_400_000;
  const fifteenHours = 15 * 3_600_000;
  const thirtyMinutes = 30 * 60_000;
  expect(millisecondsFromTerm(term)).toBe(tenDays + fifteenHours + thirtyMinutes + 5_000);
});

test("millisecondsFromTerm() returns 0 for an empty or unparsable value, instead of throwing", () => {
  expect(millisecondsFromTerm(factory.literal("", xsd("duration")))).toBe(0);
  expect(millisecondsFromTerm(factory.literal("not a duration", xsd("duration")))).toBe(0);
});

test("termFromMilliseconds() produces an xsd:duration literal round-tripping the same total", () => {
  const literal = termFromMilliseconds(2 * 3_600_000 + 15 * 60_000);
  expect(literal.datatype).toEqual(xsd("duration"));
  expect(millisecondsFromTerm(literal)).toBe(2 * 3_600_000 + 15 * 60_000);
});

test("termFromMilliseconds() round-trips zero", () => {
  const literal = termFromMilliseconds(0);
  expect(millisecondsFromTerm(literal)).toBe(0);
});
