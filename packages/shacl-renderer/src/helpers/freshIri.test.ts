import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { queryPrefixes } from "@/helpers/namespaces.ts";
import { freshIri } from "@/helpers/freshIri.ts";

const graph = (turtle: string) => parseRdf(`${queryPrefixes}\n\n${turtle}`, "text/turtle");

test("freshIri mints a urn:uuid without shui:defaultNamespace", async () => {
  expect(freshIri(await graph(`ex:config a shui:Configuration .`)).value).toMatch(/^urn:uuid:/);
});

test("freshIri mints inside shui:defaultNamespace when configured", async () => {
  const shapesGraph = await graph(
    `ex:config a shui:Configuration ; shui:defaultNamespace "http://example.org/data/" .`,
  );
  const first = freshIri(shapesGraph);
  expect(first.value).toMatch(/^http:\/\/example\.org\/data\/[0-9a-f-]{36}$/);
  expect(freshIri(shapesGraph).equals(first)).toBe(false);
});
