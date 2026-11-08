import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes, schema } from "@/helpers/namespaces.ts";
import { groupValues } from "@/structure/groupByValues.ts";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

const data = `
  ex:either schema:datePublished "1843-02-20"^^xsd:date .
  ex:fear schema:dateCreated "1843-10-16"^^xsd:date .
  ex:sickness schema:datePublished "1849-07-30"^^xsd:date .
  ex:aristotle schema:datePublished "-0383-01-01T00:00:00Z"^^xsd:dateTime .
  ex:genre schema:genre ex:poetry .
  ex:poetry rdfs:label "Poetry"@en .
`;

const dates: PropertyPath = {
  type: "alternative",
  items: [
    { type: "predicate", predicate: schema("dateCreated") },
    { type: "predicate", predicate: schema("datePublished") },
  ],
};

const group = async (
  ids: string[],
  path: PropertyPath,
  template: string | undefined,
  labelOf = (term: { value: string }) => term.value,
) =>
  groupValues(
    ids.map((id) => ex(id)),
    {
      path,
      template,
      dataGraph: await parseRdf(`${queryPrefixes}\n\n${data}`, "text/turtle"),
      languages: ["en"],
      locale: "en",
      labelOf,
    },
  ).map(({ key, objects }) => ({ key, ids: objects.map((object) => object.value.slice(19)) }));

test("values whose template text is the same share a group, in the order they came in", async () => {
  expect(
    await group(["either", "sickness", "fear", "undated"], dates, "[{0:year}|{1:year}]"),
  ).toEqual([
    { key: "1843", ids: ["either", "fear"] },
    { key: "1849", ids: ["sickness"] },
    { key: "", ids: ["undated"] },
  ]);
});

test("a year before the common era is written as BCE", async () => {
  expect(await group(["aristotle"], dates, "[{0:year}|{1:year}]")).toEqual([
    { key: "384 BCE", ids: ["aristotle"] },
  ]);
});

test("without a template a resource groups by its label", async () => {
  expect(
    await group(
      ["genre"],
      { type: "predicate", predicate: schema("genre") },
      undefined,
      () => "Poetry",
    ),
  ).toEqual([{ key: "Poetry", ids: ["genre"] }]);
});
