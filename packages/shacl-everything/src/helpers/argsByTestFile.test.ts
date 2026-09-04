import { expect, test } from "vite-plus/test";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

const cwd = "http://example.org/fixtures/";

test("a single filename resolves shapesGraph/dataGraph to one URL", () => {
  const args = argsByTestFile("foo.ttl", cwd);

  expect(args.shapesGraph).toEqual(new URL("foo.ttl", cwd));
  expect(args.dataGraph).toEqual(new URL("foo.ttl", cwd));
  expect(args.nodeShapes).toEqual([expect.objectContaining({ value: "http://example.org/fixtures/foo.ttl#shape" })]);
  expect(args.focusNode.value).toBe("http://example.org/fixtures/foo.ttl#data");
});

test("an array of filenames is merged into shapesGraph/dataGraph, anchored on the first", () => {
  const args = argsByTestFile(["foo.ttl", "shared.ttl"], cwd);

  expect(args.shapesGraph).toEqual([new URL("foo.ttl", cwd), new URL("shared.ttl", cwd)]);
  expect(args.dataGraph).toEqual([new URL("foo.ttl", cwd), new URL("shared.ttl", cwd)]);
  expect(args.focusNode.value).toBe("http://example.org/fixtures/foo.ttl#data");
});

test("readOnlyGraphFilename also accepts one or more filenames", () => {
  const single = argsByTestFile("foo.ttl", cwd, "readonly.ttl");
  expect(single.readOnlyGraph).toEqual(new URL("readonly.ttl", cwd));

  const multiple = argsByTestFile("foo.ttl", cwd, ["readonly-a.ttl", "readonly-b.ttl"]);
  expect(multiple.readOnlyGraph).toEqual([
    new URL("readonly-a.ttl", cwd),
    new URL("readonly-b.ttl", cwd),
  ]);
});
