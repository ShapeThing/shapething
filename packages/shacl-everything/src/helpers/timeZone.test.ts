import { expect, test } from "vite-plus/test";
import { inTimeZone, withTimeZone } from "@/helpers/timeZone.ts";

test("withTimeZone appends the zone's offset at that wall-clock moment, DST included", () => {
  expect(withTimeZone("2024-05-01T09:30:00", "Europe/Amsterdam")).toBe("2024-05-01T09:30:00+02:00");
  expect(withTimeZone("2024-01-15T09:30:00", "Europe/Amsterdam")).toBe("2024-01-15T09:30:00+01:00");
  expect(withTimeZone("2024-01-15T09:30:00", "America/New_York")).toBe("2024-01-15T09:30:00-05:00");
  expect(withTimeZone("2024-01-15T09:30:00", "Asia/Kolkata")).toBe("2024-01-15T09:30:00+05:30");
  expect(withTimeZone("2024-01-15T09:30:00", "UTC")).toBe("2024-01-15T09:30:00Z");
});

test("withTimeZone leaves a value that already has an offset, or doesn't parse, unchanged", () => {
  expect(withTimeZone("2024-05-01T09:30:00Z", "Europe/Amsterdam")).toBe("2024-05-01T09:30:00Z");
  expect(withTimeZone("2024-05-01T09:30:00-03:00", "Europe/Amsterdam")).toBe(
    "2024-05-01T09:30:00-03:00",
  );
  expect(withTimeZone("", "Europe/Amsterdam")).toBe("");
});

test("inTimeZone converts a timezoned value to the zone's wall-clock time", () => {
  expect(inTimeZone("2024-05-01T07:30:00Z", "Europe/Amsterdam")).toBe("2024-05-01T09:30:00");
  expect(inTimeZone("2024-05-01T09:30:00+02:00", "America/New_York")).toBe("2024-05-01T03:30:00");
  expect(inTimeZone("2024-05-01T09:30:00", "America/New_York")).toBe("2024-05-01T09:30:00");
});

test("inTimeZone and withTimeZone round-trip", () => {
  const written = withTimeZone("2024-10-27T12:00:00", "Europe/Amsterdam");
  expect(inTimeZone(written, "Europe/Amsterdam")).toBe("2024-10-27T12:00:00");
});
