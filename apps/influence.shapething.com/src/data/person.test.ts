import { DataFactory } from "rdf-data-factory";
import { expect, test } from "vite-plus/test";
import { entityFromRows, type EntityRow, summariesFromRows, summarize } from "./person.ts";

const factory = new DataFactory();
const wd = (id: string) => factory.namedNode(`http://www.wikidata.org/entity/${id}`);
const integer = (value: number) =>
  factory.literal(String(value), factory.namedNode("http://www.w3.org/2001/XMLSchema#integer"));
const bool = (value: boolean) =>
  factory.literal(String(value), factory.namedNode("http://www.w3.org/2001/XMLSchema#boolean"));

test("a summary takes each value from the first row that has one", () => {
  const summary = summarize(wd("Q859"), [
    { influence: integer(12), mulName: factory.literal("Platon", "mul") },
    { influence: integer(12), name: factory.literal("Plato", "en"), image: wd("image") },
  ]);
  expect(summary.id).toBe("Q859");
  expect(summary.name).toBe("Plato");
  expect(summary.image?.value).toBe(wd("image").value);
  expect(summary.influence).toBe(12);
});

test("without a label the name is the identifier", () => {
  expect(summarize(wd("Q1"), [{ influence: integer(0) }]).name).toBe("Q1");
});

test("the rows are grouped by person, in the order of the query", () => {
  const people = summariesFromRows([
    { person: wd("Q2"), influence: integer(3) },
    { person: wd("Q1"), influence: integer(2) },
    { person: wd("Q2"), influence: integer(3) },
  ]);
  expect(people.map((person) => person.id)).toEqual(["Q2", "Q1"]);
});

const entityRow = (row: Partial<EntityRow>): EntityRow => ({
  influence: integer(0),
  isHuman: bool(false),
  hasAuthor: bool(false),
  ...row,
});

test("the kind of an entity: a person, a work or a concept", () => {
  expect(entityFromRows(wd("Q1"), [entityRow({ isHuman: bool(true) })]).kind).toBe("person");
  expect(entityFromRows(wd("Q1"), [entityRow({ hasAuthor: bool(true) })]).kind).toBe("work");
  expect(entityFromRows(wd("Q1"), [entityRow({})]).kind).toBe("concept");
});

test("the demonym of a country is the one qualified as adjective", () => {
  const denmark = { citizenship: wd("Q35"), flag: wd("flag") };
  const entity = entityFromRows(wd("Q6512"), [
    entityRow({ ...denmark, demonym: factory.literal("Dane", "en") }),
    entityRow({
      ...denmark,
      demonym: factory.literal("Danish", "en"),
      demonymIsAdjective: bool(true),
    }),
  ]);
  expect(entity.citizenships).toHaveLength(1);
  expect(entity.citizenships[0].demonym?.value).toBe("Danish");
});

test("without an adjective, only a single demonym is used", () => {
  const uk = { citizenship: wd("Q145"), flag: wd("flag") };
  const entity = entityFromRows(wd("Q1"), [
    entityRow({ ...uk, demonym: factory.literal("British", "en") }),
    entityRow({ ...uk, demonym: factory.literal("Briton", "en") }),
  ]);
  expect(entity.citizenships[0].demonym).toBeUndefined();
});
