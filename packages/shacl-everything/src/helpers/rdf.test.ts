import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";

test("parseRdf - parses turtle content into a store", async () => {
  const store = await parseRdf(
    `
        @prefix ex: <http://example.com/> .
        ex:Alice ex:name "Alice" .
    `,
    "text/turtle",
  );

  expect(store.getQuads(ex("Alice"), ex("name"))).toHaveLength(1);
  expect(store.getQuads(ex("Alice"), ex("name"))[0].object.value).toEqual("Alice");
});

test("parseRdf - parses a different content type (JSON-LD)", async () => {
  const store = await parseRdf(
    JSON.stringify({
      "@id": "http://example.com/Alice",
      "http://example.com/name": "Alice",
    }),
    "application/ld+json",
  );

  expect(store.getQuads(ex("Alice"), ex("name"))).toHaveLength(1);
});

test("parseRdf - returns an empty store for empty content", async () => {
  const store = await parseRdf("", "text/turtle");
  expect(store.getQuads(null, null, null, null)).toHaveLength(0);
});

test("parseRdf - returns an empty store for whitespace-only content", async () => {
  const store = await parseRdf("   \n\t  ", "text/turtle");
  expect(store.getQuads(null, null, null, null)).toHaveLength(0);
});

test("parseRdf - rejects on syntactically invalid content", async () => {
  await expect(parseRdf("this is not valid turtle @@@", "text/turtle")).rejects.toThrow();
});
