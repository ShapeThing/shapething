import { expect, test } from "vite-plus/test";
import { matchesProperty } from "@/outputs/render/hooks/usePropertyValidationResults.tsx";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";
import { ex, sh } from "@/helpers/namespaces.ts";

const baseResult: ValidationResult = {
  focusNode: ex("Alice"),
  sourceShape: ex("property1"),
  severity: sh("Violation"),
  message: ["too few values"],
};

const property = {
  focusNode: ex("Alice"),
  propertyShapes: [ex("property1")],
};

test("matches when focusNode and sourceShape both agree", () => {
  expect(matchesProperty(baseResult, property)).toBe(true);
});

test("matches when sourceShape is any of several grouped property shapes", () => {
  const grouped = { focusNode: ex("Alice"), propertyShapes: [ex("property0"), ex("property1")] };
  expect(matchesProperty(baseResult, grouped)).toBe(true);
});

test("excludes a result for a different focus node", () => {
  const result = { ...baseResult, focusNode: ex("Bob") };
  expect(matchesProperty(result, property)).toBe(false);
});

test("excludes a result whose sourceShape isn't one of this element's property shapes", () => {
  const result = { ...baseResult, sourceShape: ex("property2") };
  expect(matchesProperty(result, property)).toBe(false);
});

test("excludes a result with no sourceShape at all (e.g. a node-level constraint)", () => {
  const result = { ...baseResult, sourceShape: undefined };
  expect(matchesProperty(result, property)).toBe(false);
});
