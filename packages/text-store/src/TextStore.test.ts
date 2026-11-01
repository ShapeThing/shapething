import { QueryEngine } from "@comunica/query-sparql";
import type * as RDF from "@rdfjs/types";
import { DataFactory, Store } from "n3";
import { expect, test } from "vitest";
import { TextStore, defaultSearchTerm } from "./TextStore";
const { namedNode, literal, quad } = DataFactory;

const names = [
  quad(namedNode("a"), namedNode("https://schema.org/name"), literal("John Doe")),
  quad(namedNode("b"), namedNode("https://schema.org/name"), literal("Johanna Doe")),
  quad(namedNode("c"), namedNode("https://schema.org/name"), literal("Frank Doe")),
];

const createStore = () => {
  const store = new TextStore();
  for (const name of names) store.add(name);
  return store;
};

const toArray = (stream: RDF.Stream<RDF.Quad>): Promise<RDF.Quad[]> =>
  new Promise((resolve, reject) => {
    const quads: RDF.Quad[] = [];
    stream.on("data", (quad: RDF.Quad) => quads.push(quad));
    stream.on("end", () => resolve(quads));
    stream.on("error", reject);
  });

const search = (store: TextStore, text: string) =>
  toArray(store.match(null, defaultSearchTerm, literal(text)));

test("match, check additions and deletions", async () => {
  const store = createStore();
  const result = await search(store, "Jo");
  expect(result.map((quad) => quad.object.value)).toEqual(["John Doe", "Johanna Doe"]);

  expect((await search(store, "Peter")).length).toBe(0);
  store.add(quad(namedNode("c"), namedNode("https://schema.org/name"), literal("Peter Peterson")));
  store.add(quad(namedNode("c"), namedNode("https://schema.org/name"), literal("Peter Jackson")));
  expect((await search(store, "Peter")).length).toBe(2);
  store.delete(
    quad(namedNode("c"), namedNode("https://schema.org/name"), literal("Peter Peterson")),
  );
  expect((await search(store, "Peter")).length).toBe(1);
  store.delete(
    quad(namedNode("c"), namedNode("https://schema.org/name"), literal("Peter Jackson")),
  );
  expect((await search(store, "Peter")).length).toBe(0);
});

test("query", async () => {
  const store = createStore();

  const engine = new QueryEngine();
  const response = await engine.queryBindings(
    `select * where {
      ?s <https://textstore.shapething.com/search> "Fr" .
      ?s ?p ?o
    }`,
    {
      sources: [store],
    },
  );

  const bindings = await response.toArray();
  expect(bindings[0].get("p")?.value).toBe("https://schema.org/name");
  expect(bindings[0].get("o")?.value).toBe("Frank Doe");
  expect(bindings.length).toBe(1);
});

test("wraps an existing store", async () => {
  const store = new TextStore({ store: new Store(names) });
  const result = await search(store, "Jo");
  expect(result.map((quad) => quad.subject.value)).toEqual(["a", "b"]);
});

test("passes other patterns through to the wrapped store", async () => {
  const store = new TextStore({ store: new Store(names) });
  const result = await toArray(store.match(namedNode("c")));
  expect(result.map((quad) => quad.object.value)).toEqual(["Frank Doe"]);
});

test("reindex picks up changes made directly to the wrapped store", async () => {
  const inner = new Store(names);
  const store = new TextStore({ store: inner });
  expect((await search(store, "Peter")).length).toBe(0);

  inner.add(quad(namedNode("d"), namedNode("https://schema.org/name"), literal("Peter Jackson")));
  await store.reindex();
  expect((await search(store, "Peter")).length).toBe(1);
});

test("adding to a read only store fails", () => {
  const inner = new Store(names);
  const readOnly: RDF.Source = { match: inner.match.bind(inner) as RDF.Source["match"] };
  const store = new TextStore({ store: readOnly });
  expect(() => store.add(names[0])).toThrow();
});
