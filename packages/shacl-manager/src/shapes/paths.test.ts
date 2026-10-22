import { describe, expect, it } from "vitest";
import { sh } from "@/helpers/namespaces.ts";
import { blank, ex, list, storeOf } from "@/helpers/testing.ts";
import { describePath } from "./paths.ts";

describe("describePath", () => {
  it("treats a plain IRI as a predicate path", () => {
    const info = describePath(storeOf(), ex("name"));
    expect(info.predicate?.equals(ex("name"))).toBe(true);
    expect(info.iris.map((iri) => iri.value)).toEqual([ex("name").value]);
  });

  it("reads sequence, inverse and alternative paths and collects every IRI", () => {
    const alternative = list([ex("label"), ex("title")], "alt");
    const sequence = list([blank("inverse"), blank("alternative")], "seq");
    const store = storeOf(
      ...alternative.triples,
      ...sequence.triples,
      [blank("inverse"), sh("inversePath"), ex("broader")],
      [blank("alternative"), sh("alternativePath"), alternative.head],
    );

    const info = describePath(store, sequence.head);
    expect(info.predicate).toBeUndefined();
    expect(info.iris.map((iri) => iri.value)).toEqual(
      ["broader", "label", "title"].map((name) => ex(name).value),
    );
    expect(info.text).toBe("^ex:broader/(ex:label|ex:title)");
  });

  it("brackets a compound path under a unary operator", () => {
    const sequence = list([ex("a"), ex("b")], "seq");
    const store = storeOf(...sequence.triples, [
      blank("star"),
      sh("zeroOrMorePath"),
      sequence.head,
    ]);
    expect(describePath(store, blank("star")).text).toBe("(ex:a/ex:b)*");
  });

  it("does not throw on a malformed path", () => {
    expect(describePath(storeOf(), blank("nothing")).text).toBe("?");
  });
});
