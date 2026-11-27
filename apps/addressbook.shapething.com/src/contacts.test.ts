import type { Source } from "@rdfjs/types";
import { TextStore } from "@shapething/textstore";
import { DataFactory, Store } from "n3";
import { expect, test } from "vite-plus/test";
import { listContacts, searchContacts, tagCounts, withTags } from "./contacts.ts";

const { namedNode, literal, quad } = DataFactory;
const schema = (name: string) => namedNode(`https://schema.org/${name}`);
const type = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const base = "file:///book/";

// A folder as the LocalStore gives it: each file a named graph, a contact one of them.
const contact = (id: string, name: string | undefined, email?: string, tags: string[] = []) => {
  const graph = namedNode(`${base}contacts/${id}`);
  return [
    quad(graph, type, schema("Person"), graph),
    ...(name ? [quad(graph, schema("name"), literal(name), graph)] : []),
    ...(email ? [quad(graph, schema("email"), literal(email), graph)] : []),
    ...tags.map((tag) => quad(graph, schema("keywords"), literal(tag), graph)),
  ];
};

const shapeGraph = namedNode(`${base}contact-shape`);

const createStore = () =>
  new TextStore({
    store: new Store([
      ...contact("b", "Johanna Doe", "johanna@example.org", ["family", "Book club"]),
      ...contact("a", "Frank Doe", "frank@example.com", ["Family"]),
      ...contact("c", undefined),
      // The shape's own literals are indexed too, but its graph holds no contact.
      quad(
        namedNode(`${base}contact-shape#name`),
        namedNode("http://www.w3.org/ns/shacl#name"),
        literal("Name"),
        shapeGraph,
      ),
    ]) as unknown as Source,
  });

test("lists every contact by name, a contact without a name by its IRI", async () => {
  const contacts = await listContacts(createStore());
  expect(contacts.map(({ label }) => label)).toEqual(["c", "Frank Doe", "Johanna Doe"]);
  expect(contacts[1].graph.value).toBe(`${base}contacts/a`);
  expect(contacts[1].contact.value).toBe(`${base}contacts/a`);
});

test("finds contacts by any of their texts", async () => {
  const store = createStore();
  expect((await searchContacts(store, "Joh")).map(({ label }) => label)).toEqual(["Johanna Doe"]);
  expect((await searchContacts(store, "example.com")).map(({ label }) => label)).toEqual([
    "Frank Doe",
  ]);
  expect((await searchContacts(store, "Doe")).map(({ label }) => label)).toEqual([
    "Frank Doe",
    "Johanna Doe",
  ]);
  expect(await searchContacts(store, "Name")).toEqual([]);
  expect(await searchContacts(store, "Nobody")).toEqual([]);
});

test("the search text is a literal, not part of the query", async () => {
  expect(await searchContacts(createStore(), '" } } SELECT * { ?s ?p ?o')).toEqual([]);
});

test("lists every contact once, with its tags", async () => {
  const contacts = await listContacts(createStore());
  expect(contacts.map(({ label, tags }) => [label, tags])).toEqual([
    ["c", []],
    ["Frank Doe", ["Family"]],
    ["Johanna Doe", ["Book club", "family"]],
  ]);
});

test("counts the tags whatever their case, and filters by all of them", async () => {
  const contacts = await listContacts(createStore());
  expect(tagCounts(contacts)).toEqual([
    { tag: "Book club", count: 1 },
    { tag: "Family", count: 2 },
  ]);
  const only = (tag: string) => ({ tag, mode: "only" as const });
  const not = (tag: string) => ({ tag, mode: "not" as const });
  const labels = (rules: Parameters<typeof withTags>[1]) =>
    withTags(contacts, rules).map(({ label }) => label);
  expect(labels([only("FAMILY")])).toEqual(["Frank Doe", "Johanna Doe"]);
  expect(labels([only("family"), only("book club")])).toEqual(["Johanna Doe"]);
  expect(labels([not("family")])).toEqual(["c"]);
  expect(labels([only("family"), not("Book club")])).toEqual(["Frank Doe"]);
  expect(withTags(contacts, [])).toHaveLength(3);
});

test("finds contacts by their tags", async () => {
  expect((await searchContacts(createStore(), "Book club")).map(({ label }) => label)).toEqual([
    "Johanna Doe",
  ]);
});
