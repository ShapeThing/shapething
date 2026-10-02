import { expect, test } from "vite-plus/test";
import { textDiff } from "@/helpers/textDiff.ts";

test("marks the changed word, keeping the rest unchanged", () => {
  expect(textDiff("the quick brown fox", "the slow brown fox")).toEqual([
    { type: "same", text: "the " },
    { type: "removed", text: "quick" },
    { type: "added", text: "slow" },
    { type: "same", text: " brown fox" },
  ]);
});

test("pure insertions and deletions", () => {
  expect(textDiff("Hello", "Hello world")).toEqual([
    { type: "same", text: "Hello" },
    { type: "added", text: " world" },
  ]);
  expect(textDiff("Hello world", "world")).toEqual([
    { type: "removed", text: "Hello " },
    { type: "same", text: "world" },
  ]);
});

test("identical and empty texts", () => {
  expect(textDiff("same", "same")).toEqual([{ type: "same", text: "same" }]);
  expect(textDiff("", "new")).toEqual([{ type: "added", text: "new" }]);
  expect(textDiff("old", "")).toEqual([{ type: "removed", text: "old" }]);
});
