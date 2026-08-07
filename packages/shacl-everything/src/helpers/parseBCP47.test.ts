import { expect, test } from "vite-plus/test";
import { canonicalizeBCP47 } from "@/helpers/parseBCP47.ts";

test("canonicalizeBCP47 - canonicalizes casing", () => {
  expect(canonicalizeBCP47("en-gb")).toBe("en-GB");
  expect(canonicalizeBCP47("EN")).toBe("en");
  expect(canonicalizeBCP47("zh-hans-cn")).toBe("zh-Hans-CN");
});

test("canonicalizeBCP47 - trims surrounding whitespace", () => {
  expect(canonicalizeBCP47("  fr-FR  ")).toBe("fr-FR");
});

test("canonicalizeBCP47 - rejects malformed input", () => {
  expect(canonicalizeBCP47("not a tag")).toBeUndefined();
  expect(canonicalizeBCP47("123")).toBeUndefined();
  expect(canonicalizeBCP47("")).toBeUndefined();
  expect(canonicalizeBCP47("   ")).toBeUndefined();
});

test("canonicalizeBCP47 - rejects tags outside the language[-script][-region] subset", () => {
  expect(canonicalizeBCP47("en-US-u-ca-gregory")).toBeUndefined();
});
