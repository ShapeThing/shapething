import { RdfStore } from "rdf-stores";
import { expect, test } from "vite-plus/test";
import { ex } from "@/helpers/namespaces.ts";
import { factory } from "@/helpers/factory.ts";
import { select } from "@/helpers/queryEngine.ts";

const graph = ex("graph");

function store() {
  const store = RdfStore.createDefault();
  const node = factory.blankNode("node");
  store.addQuad(factory.quad(ex("a"), ex("has"), node, graph));
  store.addQuad(factory.quad(node, ex("name"), factory.literal("Blank"), graph));
  return { store, node };
}

test("select sees named graphs and returns the store's own blank nodes", async () => {
  const { store: source, node } = store();
  const rows = await select("SELECT ?object WHERE { ?subject ?predicate ?object }", source, {
    subject: ex("a"),
  });
  expect(rows).toHaveLength(1);
  expect(rows[0].object.equals(node)).toBe(true);
});

test("select binds a blank node from the store", async () => {
  const { store: source, node } = store();
  const rows = await select(
    "SELECT ?name WHERE { ?node <http://example.org/name> ?name }",
    source,
    {
      node,
    },
  );
  expect(rows.map((row) => row.name.value)).toEqual(["Blank"]);
});
