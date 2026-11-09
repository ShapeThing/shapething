import { expect, test } from "vite-plus/test";
import { wd } from "../rdf/namespaces.ts";
import { parameterize } from "./parameterize.ts";

test("a list binds its variable at the start of the outermost WHERE block", () => {
  const query = parameterize("SELECT ?name WHERE { $entity ?p ?name }", {
    entity: [wd("Q1"), wd("Q2")],
  });
  expect(query).toContain(
    "WHERE {\n  VALUES ?entity { <http://www.wikidata.org/entity/Q1> <http://www.wikidata.org/entity/Q2> }",
  );
  expect(query).toContain("?entity ?p ?name");
});

test("a list fills the empty VALUES block of its own the query has", () => {
  const query = parameterize(
    "SELECT ?item WHERE { ?item ?p ?o . OPTIONAL { VALUES $class { } ?item a $class } }",
    { class: [wd("Q5")] },
  );
  expect(query).toBe(
    "SELECT ?item WHERE { ?item ?p ?o . OPTIONAL { VALUES ?class { <http://www.wikidata.org/entity/Q5> } ?item a ?class } }",
  );
});

test("a query goes out without its comment lines and indentation", async () => {
  const { compact } = await import("./select.ts");
  expect(
    compact("# A comment\nSELECT ?a WHERE {\n  # why\n  ?a <http://x.org/ns#p> ?b .\n}\n"),
  ).toBe("SELECT ?a WHERE {\n?a <http://x.org/ns#p> ?b .\n}");
});
