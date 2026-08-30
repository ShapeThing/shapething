import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { parsePathNode, parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import { writePropertyPath } from "@/structure/paths/writePropertyPath.ts";

test("writePropertyPath: a predicate path needs no triples of its own", () => {
  const store = RdfStore.createDefault();
  const term = writePropertyPath({ type: "predicate", predicate: ex("age") }, store);
  expect(term.equals(ex("age"))).toBe(true);
  expect(store.size).toBe(0);
});

test("writePropertyPath: round-trips a compound path (alternative of a sequence and an inverse)", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n
      ex:property1 sh:path [
        sh:alternativePath (
          ( ex:worksFor ex:name )
          [ sh:inversePath ex:employs ]
        )
      ] .
    `,
    "text/turtle",
  );
  const originalPath = parsePropertyPath(ex("property1"), shapesGraph)!;

  const store = RdfStore.createDefault();
  const writtenNode = writePropertyPath(originalPath, store);
  const roundTripped = parsePathNode(writtenNode, store);

  expect(toSparql(roundTripped)).toEqual(toSparql(originalPath));
});

test("writePropertyPath: writing the same path twice never shares node identity", async () => {
  const shapesGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:property1 sh:path [ sh:zeroOrMorePath ex:knows ] .`,
    "text/turtle",
  );
  const path = parsePropertyPath(ex("property1"), shapesGraph)!;

  const store = RdfStore.createDefault();
  const first = writePropertyPath(path, store);
  const second = writePropertyPath(path, store);

  expect(first.equals(second)).toBe(false);
});
