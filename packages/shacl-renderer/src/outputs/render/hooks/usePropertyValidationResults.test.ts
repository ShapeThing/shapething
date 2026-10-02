import { describe, expect, test } from "vite-plus/test";
import {
  matchesProperty,
  selectPropertyResults,
} from "@/outputs/render/hooks/usePropertyValidationResults.tsx";
import { indexValidationResults } from "@/outputs/render/contexts/validationIndex.ts";
import type { ValidationResult } from "@/outputs/render/contexts/validationContext.tsx";
import { ex, sh } from "@/helpers/namespaces.ts";
import { factory } from "@/helpers/factory.ts";

const baseResult: ValidationResult = {
  focusNode: ex("Alice"),
  sourceShape: ex("property1"),
  severity: sh("Violation"),
  message: [factory.literal("too few values")],
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

describe("indexed selection", () => {
  const valueResult: ValidationResult = { ...baseResult, value: factory.literal("x") };
  const otherProperty: ValidationResult = { ...baseResult, sourceShape: ex("property2") };
  const other = { ...property, propertyShapes: [ex("property2")] };

  test("selects the same results matchesProperty does, split by scope", () => {
    const index = indexValidationResults([baseResult, valueResult, otherProperty]);
    expect(selectPropertyResults(index, property)).toEqual([baseResult, valueResult]);
    expect(selectPropertyResults(index, property, "property-wide")).toEqual([baseResult]);
    expect(selectPropertyResults(index, property, { value: factory.literal("x") })).toEqual([
      valueResult,
    ]);
  });

  test("reuses a property's previous result array when a new run leaves it unchanged", () => {
    const first = indexValidationResults([baseResult, otherProperty]);
    // A fresh run hands back structurally-equal but brand-new objects.
    const second = indexValidationResults(
      [{ ...baseResult }, { ...otherProperty, message: [factory.literal("changed")] }],
      first,
    );
    expect(selectPropertyResults(second, property)).toBe(selectPropertyResults(first, property));
    expect(selectPropertyResults(second, other)).not.toBe(selectPropertyResults(first, other));
  });
});
